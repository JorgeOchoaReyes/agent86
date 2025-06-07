import type { Tool } from "@google-cloud/vertexai"; 
import { SquareClient, SquareEnvironment } from "square"; 
import { v4 } from "uuid"; 

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const logSquareObject = (obj: any) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  console.log(JSON.stringify(obj, (_, v) => typeof v === "bigint" ? v.toString() : v));
};

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

export const getMenuItems = async (accessToken: string) => {
  const square = new SquareClient({
    environment: SquareEnvironment.Production,
    token: accessToken,
  }); 

  try {
    const catalogItems = await square.catalog.list({});
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
 
        if(item.presentAtLocationIds?.length === 0 || (!item.presentAtAllLocations && !!!item.absentAtLocationIds)) { 
          return null;
        }

        return {
          id: item.id,
          name: item.itemData?.name,
          image: imageUrl,
        };
      }));

      return itemDetails.filter((item) => item !== null) as {id: string, name: string, image: string}[];
    }

  } catch (err) {
    console.log(err);
  }
};
  
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
 

    await square.catalog.object.upsert({
      idempotencyKey: v4(),
      object: item
    });

    return "Success!";

  } catch (err) {
    console.log(err);
  }

};

export const markItemUn86 = async (accessToken: string, itemId: string) => {
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
 
    item.presentAtAllLocations = true;
    item.itemData?.variations?.forEach((i) => { 
      i.presentAtAllLocations = true;
    });
 

    await square.catalog.object.upsert({
      idempotencyKey: v4(),
      object: item
    });

    return "Success!";

  } catch (err) {
    console.log(err);
  }

};

export const restaruantTools = {
  function_declarations: [
    {
      name: "getMenuItem",
      description: "Retrieves a list of menu items from Square, including their ID, name, description, and image URL.",
      parameters: {
        type: "object", 
      }, 
    },
    {
      name: "markItem86",
      description: "Searches an item to mark as 86 to remove it from Square all locations. This should be used when removing, or 86 an item.",
      parameters: {
        type: "object",
      }
    },
    {
      name: "markItemUn86",
      description: "Searches an item to mark as available from Square all locations. This should be used when users want to re add or un86 an item.",
      parameters: {
        type: "object",
      }
    }
  ],
} as Tool; 