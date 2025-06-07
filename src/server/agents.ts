import { type VertexAiAccount } from "./../types/index";
import { VertexAI } from "@google-cloud/vertexai";

export const findItemsInRecentMessage = async (messages: string[]) => {
  const vertexAIAccount = JSON.parse(process.env.VERTEX_AI_ACCOUNT ?? "{}") as VertexAiAccount; 
  
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
      You are a helpful assitant to help find in the users messages what is the name of the menu item that they are trying to talk about, they could be talking about multiple.
      ## For Example
          USER:
            Can you 86 chicken.  
          Result:
            chicken,
    `, 
  }); 
  
  const brew = await model.generateContent({
    contents: [{
      role: "user", 
      parts: [{
        text: messages[messages.length - 1] ?? ""
      }]
    }]
  });

  const response = brew?.response?.candidates?.[0]?.content.parts[0]?.text; 

  return response;
  
};
