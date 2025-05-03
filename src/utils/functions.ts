import {SquareClient} from "square"; 

export const getPossibleMenuItems = async (accessToken: string, itemName: string) => {
  const square = new SquareClient({
    environment: "production",
  });
  return ""; 
};