import fetch from "node-fetch";
import { getProductLabels } from "./productLabels";

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

export async function syncLabelsToShopify(shop, productId) {
  try {
    const labels = await getProductLabels(shop, productId);

    // Format product ID to match Shopify's format if needed
    const formattedProductId = productId.includes('gid://') ? productId : `gid://shopify/Product/${productId}`;

    const metafieldData = {
      metafield: {
        namespace: "custom",
        key: "labels",
        value: JSON.stringify(labels),
        type: "json",
        owner_id: formattedProductId,
        owner_resource: "product",
      },
    };

    const url = `https://${SHOPIFY_STORE}/admin/api/2023-01/metafields.json`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metafieldData),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync labels: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error syncing labels:', error);
    throw error;
  }
}
