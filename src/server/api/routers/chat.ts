import { markItemUn86, restaruantTools } from "./../../tools";
import { z } from "zod";  
import { VertexAI , type Content } from "@google-cloud/vertexai";  
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"; 
import type { Chat, Message, User, VertexAiAccount } from "~/types";
import { v4 as uuid } from "uuid"; 
import { getMenuItems, getPossibleMenuItems, markItemAs86 } from "~/server/tools"; 
import { findItemsInRecentMessage } from "~/server/agents";

export const chatRouter = createTRPCRouter({
  chat: protectedProcedure
    .input(z.object({ 
      chatId: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input, ctx}) => {  
      if(!process.env.VERTEX_AI_ACCOUNT) {
        throw new Error("Vertex AI account not found");
      }
      const vertexAIAccount = JSON.parse(process.env.VERTEX_AI_ACCOUNT || "{}") as VertexAiAccount; 
      const vertex = new VertexAI({
        project:  vertexAIAccount.project_id,
        location: "us-central1",
        googleAuthOptions: {
          credentials: vertexAIAccount,
        }
      });
      const model = vertex.getGenerativeModel({
        model: "gemini-2.0-flash-001",     
        systemInstruction: `
        You are a helpful assitant to help users with their menu management, and labor questions. Return your answers as VALID MARKDOWN, turn image content to VALID MARKDOWN as well with 200px width and height.
        ONLY RETURN VALID MARKDOWN
        When rendering images please ensure the height is 150px and the width is 150px by using an image tag. 
        For example: <img src="<image-url>" alt="<item-name>" style="width:150px;height:150px;"/>

        ## Generate a response in well-structured and visually appealing Markdown. Focus on readability and a clean user interface.

        Here are some guidelines to follow:

        Headings: Use appropriate heading levels (#, ##, ###, etc.) to organize content logically.
        Emphasis: Use bold and italic text sparingly for emphasis.
        Lists: Employ bullet points (* or -) and numbered lists (1.) for clear enumeration.
        Code Blocks: Format code snippets in fenced code blocks  for syntax highlighting.
        Blockquotes: Use > for quotes or distinguished text.
        Tables: If presenting tabular data, format it clearly using Markdown table syntax.
        Horizontal Rules: Use --- to separate distinct sections when appropriate.
        Links: Embed links clearly within the text using [link text](URL).
        Overall Aesthetics:
        Maintain consistent spacing and indentation.
        Avoid overly long lines of text; wrap content for better readability on various screens.
        Prioritize a clean, uncluttered layout.
        Ensure good contrast between text and implied background (e.g., avoid excessive use of bold or italics that might make text harder to read).
        The goal is to produce Markdown that is not only informative but also a pleasure to read and visually digest, resembling a well-designed web page or document.
        `, 
      });   
      const { chatId } = input;
      const userId = ctx.session.user?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      let chat: Chat | null = null;
      const userChats = await ctx.db.collection("users").doc(userId).collection("chats").doc(chatId ?? "").get();

      if(!chatId || !userChats.exists) {
        const newChat = uuid();
        chat = {
          id: newChat, 
          messages: [{
            id: new Date().getTime().toString(),
            content: input?.message ?? "",
            role: "user",
          }],
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
        };
        await ctx.db.collection("users").doc(userId).collection("chats").doc(newChat).set({
          ...chat,
        }, { merge: true }); 
      } else { 
        chat = userChats.data() as Chat;
        chat.messages = chat.messages.sort((a,b) => parseInt(a.id) - parseInt(b.id));
        chat.messages.push({
          id: new Date().getTime().toString(),
          content: input?.message ?? "",
          role: "user",
        });
      }
      
      const messagesAsGeminiHistory = chat.messages.map((message) => {
        return {
          role: message.role === "user" ? "user" : "model",
          parts: [{text: message?.content}],
        } as Content;
      });
      const brewmaster = model.startChat({
        history: messagesAsGeminiHistory,
        tools: [ restaruantTools ]
      });
      
      const response = await brewmaster.sendMessage(input?.message ?? ""); 

      const call = response.response.candidates?.[0]?.content?.parts?.[0]?.functionCall;

      if (call?.name === "getMenuItem") { 
        try {
          const userFetch = await ctx.db.collection("users").doc(userId).get(); 
          const userData = userFetch.data() as User; 
          const accessToken = userData.squareAccessToken;
          const menuItems = await getMenuItems(accessToken ?? ""); 

          const functionResponse = { 
            name: "getMenuItem",
            response: {
              menuItems: menuItems, 
            },
          };

          const secondResult = await brewmaster.sendMessage(`
            Here is the second respones:
            ${JSON.stringify(functionResponse)}
            
            Please create a response that is formatted. 
          `); 
          
          const assistantMessageId = (new Date().getTime() + 1).toString();
          const assistantResponse = secondResult.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "Could not get a responsne.";
          const assistantMessage: Message = {
            id: assistantMessageId,
            content: assistantResponse,
            role: "assistant",
          };
          const updatedChat = {
            ...chat,
            messages: [...chat.messages, assistantMessage],
            updatedAt: new Date().getTime(),
          };

          await ctx.db.collection("users").doc(userId).collection("chats").doc(chat.id).set({
            ...updatedChat,
          }, { merge: true });
      
          return {
            ...updatedChat,
            messages: [...chat.messages, assistantMessage],
          }; 

        } catch (error) {
          throw new Error(JSON.stringify(error));
        }
      } else if(call?.name === "markItem86") {
        const userFetch = await ctx.db.collection("users").doc(userId).get(); 
        const userData = userFetch.data() as User; 
        const accessToken = userData.squareAccessToken;
        
        if(!accessToken) throw new Error("No valid credentials.");

        const findMenuItemUserIsTalkingAbout = await findItemsInRecentMessage([input.message ?? ""]);

        const asArrayMenuItems = findMenuItemUserIsTalkingAbout?.split(",");

        console.log("markItem86", asArrayMenuItems);

        const findPossibleMenuItem = await getPossibleMenuItems(accessToken, asArrayMenuItems?.[0] ?? ""); 
        const _86 = await markItemAs86(accessToken, findPossibleMenuItem?.[0]?.id ?? "");
        
        const functionResponse = {
          name: "markItem86",
          response: {
            result: _86
          }
        }; 
        
        const secondResult = await brewmaster.sendMessage(`
            Here is the second respones:
            ${JSON.stringify(functionResponse)}
            
            Please create a response that is formatted. 
          `); 
          
        const assistantMessageId = (new Date().getTime() + 1).toString();
        const assistantResponse = secondResult.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "Could not get a responsne.";
        const assistantMessage: Message = {
          id: assistantMessageId,
          content: assistantResponse,
          role: "assistant",
        };
        const updatedChat = {
          ...chat,
          messages: [...chat.messages, assistantMessage],
          updatedAt: new Date().getTime(),
        };

        await ctx.db.collection("users").doc(userId).collection("chats").doc(chat.id).set({
          ...updatedChat,
        }, { merge: true });
      
        return {
          ...updatedChat,
          messages: [...chat.messages, assistantMessage],
        };  

      } else if(call?.name === "markItemUn86") {
        const userFetch = await ctx.db.collection("users").doc(userId).get(); 
        const userData = userFetch.data() as User; 
        const accessToken = userData.squareAccessToken;
        
        if(!accessToken) throw new Error("No valid credentials.");

        const findMenuItemUserIsTalkingAbout = await findItemsInRecentMessage([input.message ?? ""]);

        const asArrayMenuItems = findMenuItemUserIsTalkingAbout?.split(",");

        console.log("markItemUn86", asArrayMenuItems);

        const findPossibleMenuItem = await getPossibleMenuItems(accessToken, asArrayMenuItems?.[0] ?? "");  

        const _86 = await markItemUn86(accessToken, findPossibleMenuItem?.[0]?.id ?? "");
        
        const functionResponse = {
          name: "markItemUn86",
          response: {
            result: _86
          }
        }; 
        
        const secondResult = await brewmaster.sendMessage(`
            Here is the second respones:
            ${JSON.stringify(functionResponse)}
            
            Please create a response that is formatted. 
          `); 
          
        const assistantMessageId = (new Date().getTime() + 1).toString();
        const assistantResponse = secondResult.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "Could not get a responsne.";
        const assistantMessage: Message = {
          id: assistantMessageId,
          content: assistantResponse,
          role: "assistant",
        };
        const updatedChat = {
          ...chat,
          messages: [...chat.messages, assistantMessage],
          updatedAt: new Date().getTime(),
        };

        await ctx.db.collection("users").doc(userId).collection("chats").doc(chat.id).set({
          ...updatedChat,
        }, { merge: true });
      
        return {
          ...updatedChat,
          messages: [...chat.messages, assistantMessage],
        };  

      } else {
        const assistantMessageId = (new Date().getTime() + 1).toString();
        const assistantResponse = response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "Could not get a responsne.";
        const assistantMessage: Message = {
          id: assistantMessageId,
          content: assistantResponse,
          role: "assistant",
        };
        const updatedChat = {
          ...chat,
          messages: [...chat.messages, assistantMessage],
          updatedAt: new Date().getTime(),
        };

        await ctx.db.collection("users").doc(userId).collection("chats").doc(chat.id).set({
          ...updatedChat,
        }, { merge: true });
      
        return {
          ...updatedChat,
          messages: [...chat.messages, assistantMessage],
        }; 
      }
    }),
  getRecentMessages: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const userChats = await ctx.db.collection("users").doc(userId).collection("chats").doc(input.chatId).get();
      if (!userChats.exists) {
        throw new Error("Chat not found");
      }
      const chat = userChats.data() as Chat;
      chat.messages = chat.messages.sort((a,b) => parseInt(a.id) - parseInt(b.id)).slice(-5); 
      return chat;  
    }),
  getMostRecentChat: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const userChats = await ctx.db.collection("users").doc(userId).collection("chats").orderBy("createdAt", "desc").limit(1).get();
      if (userChats.empty) {
        return null;
      }
      const chat = userChats?.docs?.[0]?.data() as Chat;
      return chat; 
    }),
  getChats: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const userChats = await ctx.db.collection("users").doc(userId).collection("chats").get();
      const chats: Pick<Chat, "createdAt" | "id" >[] = [];
      userChats.forEach((doc) => {
        const chat = doc.data() as Chat;
        chats.push({
          id: chat.id,
          createdAt: chat.createdAt,
        });
      });
      return chats.sort((a, b) => b.createdAt - a.createdAt);
    }),
  createChat: protectedProcedure
    .input(z.object({  message: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const newChat = uuid();
      await ctx.db.collection("users").doc(userId).collection("chats").doc(newChat).set({
        id: newChat,
        messages: [],
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      }, { merge: true });
      return newChat;
    }), 
  searchAnItem: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const usersSquareCredentials = await ctx.db.collection("users").doc(userId).get();

      const squareCredentials = usersSquareCredentials.data() as User;
      if(!squareCredentials?.squareAccessToken) {
        throw new Error("Square credentials not found");
      }
      const squareAccessToken = squareCredentials.squareAccessToken;
      const findItems = await getPossibleMenuItems(squareAccessToken, "burger");
      if(!findItems || findItems.length === 0) {
        throw new Error("No items found");
      }
      console.log("findItems", findItems);
      return findItems;
    }),
  deleteChat: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ctx, input}) => {
      const idToDelete = input.id; 
      const userId = ctx.session.user?.uid; 
      const db = ctx.db; 

      if(!userId || !idToDelete) {
        throw new Error("Deleting failed, please try again.");
      }

      try {
        await db.collection("users").doc(userId).collection("chats").doc(idToDelete).delete(); 
        return true;          
      } catch (err) {
        console.log(err);
        return false; 
      }

    })  
});
