export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "updateLabels") {
    const productId = formData.get("productId");
    const labelIds = JSON.parse(formData.get("labelIds"));

    // Get label details
    const labels = await prisma.label.findMany({
      where: {
        id: { in: labelIds },
        shop: session.shop
      }
    });

    // Update product metafields with labels
    await admin.graphql(`
      mutation updateProductMetafield($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            metafields {
              id
              namespace
              key
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: {
          id: `gid://shopify/Product/${productId}`,
          metafields: [
            {
              namespace: "custom",
              key: "product_labels",
              type: "json",
              value: JSON.stringify(labels.map(label => ({
                id: label.id,
                name: label.name,
                color: label.color
              })))
            }
          ]
        }
      }
    });
  }

  return null;
};
