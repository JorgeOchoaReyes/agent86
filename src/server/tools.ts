import type { Tool } from "@google-cloud/vertexai"; 
import { SquareClient, SquareEnvironment } from "square"; 
import { v4 } from "uuid"; 

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

        if(item.presentAtLocationIds?.length === 0) { 
          return null;
        }

        return {
          id: item.id,
          name: item.itemData?.name,
          description: item.itemData?.description, 
          image: imageUrl,
        };
      }));

      console.log("Item Search",itemDetails );

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

        if(item.presentAtLocationIds?.length === 0) {
          // item is 86'ed
          return null;
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

export const markItem86Tool = {
  function_declarations: [
    {
      name: "markItem86",
      description: "Searches an item to mark as 86 to remove it from Square all locations. This should be used when removing, or 86 an item.",
      parameters: {
        type: "object",
      }
    }
  ]
} as Tool;

export const markItemAs86 = async (accessToken: string, itemId: string) => {
  const square = new SquareClient({
    environment: SquareEnvironment.Production, 
    token: accessToken
  });

  try {
    const getItem = await square.catalog.object.get({
      objectId: itemId
    });

    const item = getItem.object; 

    if(item?.type !== "ITEM") {
      return "Could not find menu item"; 
    }

    item.presentAtLocationIds = [];
    item.presentAtAllLocations = false;
    item.itemData?.variations?.forEach((i) => {
      i.presentAtLocationIds = [];
      i.presentAtAllLocations = false;
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    console.log(JSON.stringify(item, (_, v) => typeof v === "bigint" ? v.toString() : v));

    await square.catalog.object.upsert({
      idempotencyKey: v4(),
      object: item
    });

    return "Success!";

  } catch (err) {
    console.log(err);
  }

};