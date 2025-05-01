import { z } from "zod";  
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";  
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"; 
import type { Chat, Message } from "~/types";
import { v4 as uuid } from "uuid";

export const chatRouter = createTRPCRouter({
  chat: protectedProcedure
    .input( z.object({ 
      chatId: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input, ctx}) => {  
      const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
      const model = gemini.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: "You are a helpful assitant to help users with their menu management, and labor questions.", 
      });   
      const { chatId } = input;
      const userId = ctx.session.user?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      let chat: Chat | null = null;
      const userChats = await ctx.db.collection("users").doc(userId).collection("chats").doc(chatId ?? "").get();
      if(!chatId || !userChats.exists) {
        console.log("Creating new chat");
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
      }
      console.log("Chat ID", chat.id);
      const messagesAsGeminiHistory = chat.messages.map((message) => {
        return {
          role: message.role === "user" ? "user" : "assistant",
          parts: [{text: message?.content}],
        } as Content;
      });

      const brewmaster = model.startChat({
        history: messagesAsGeminiHistory,
      });
      
      const response = await brewmaster.sendMessage(input?.message ?? ""); 
      const assistantMessageId = (new Date().getTime() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        content: response.response.text(),
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

    }),
});
