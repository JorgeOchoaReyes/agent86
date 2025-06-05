import type { Tool } from "@google-cloud/vertexai"; 
import { SquareClient, SquareEnvironment } from "square"; 

export const getPossibleMenuItems = async (accessToken: string, itemName: string) => {
  const square = new SquareClient({
    environment: SquareEnvironment.Production,
    token: accessToken,
  });

  try {
    const {items} = await square.catalog.searchItems({
      textFilter: itemName,
      limit: 5
    });
 

    if(items?.length && items.length > 0) {
      const itemDetails = await Promise.all(items.map(async (item) => { 
        if(!item.id || !item || item.type !== "ITEM") return null;  

        const imgaes = await square.catalog.object.get({
          objectId: item.itemData?.imageIds?.[0] ?? "", 
        });

        let imageUrl = ""; 
        if(imgaes.object?.type === "IMAGE") {
          imageUrl = imgaes.object?.imageData?.url ?? "";
        }

        return {
          id: item.id,
          name: item.itemData?.name,
          description: item.itemData?.description, 
          image: imageUrl,
        };
      }));

      return itemDetails.filter((item) => item !== null) as {id: string, name: string, description: string, image: string}[];
    }
  } catch (error) {
    console.log("[Error]:", JSON.stringify(error, null, 2)); 
  }

  return null; 
};

export const getMenuItemTool = {
  function_declarations: [
    {
      name: "getMenuItem",
      description: "Retrieves a list of menu items from Square, including their ID, name, description, and image URL.",
      parameters: {
        type: "object", 
      }, 
    },
  ],
} as Tool; 

export const getMenuItem = async (accessToken: string) => {
  const square = new SquareClient({
    environment: SquareEnvironment.Production,
    token: accessToken,
  }); 
 

  try {
    const catalogItems = await square.catalog.list();
    const items = catalogItems.data; 

    if(items?.length && items.length > 0) {
      const itemDetails = await Promise.all(items.map(async (item) => { 
        if(!item.id || !item || item.type !== "ITEM") return null;  

        const imgaes = await square.catalog.object.get({
          objectId: item.itemData?.imageIds?.[0] ?? "", 
        });

        let imageUrl = ""; 
        if(imgaes.object?.type === "IMAGE") {
          imageUrl = imgaes.object?.imageData?.url ?? "";
        }

        return {
          id: item.id,
          name: item.itemData?.name,
          description: "", 
          image: imageUrl,
        };
      }));

      return itemDetails.filter((item) => item !== null) as {id: string, name: string, description: string, image: string}[];
    }

  } catch (err) {
    console.log(err);
  }
};