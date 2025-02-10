import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import * as Polaris from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    // Authenticate the admin and retrieve session data
    const { admin, session } = await authenticate.admin(request);

    console.log("Admin Object:", admin);
    console.log("Session Object:", session);

    if (!admin || !session?.shop) {
      throw new Error("Unauthorized or invalid session");
    }

    // Fetch products from Shopify Admin GraphQL API
    const response = await admin.graphql(`
      query {
        products(first: 10) {
          nodes {
              id
              title
          }
        }
      }
    `);

    const responseJson = await response.json();

    // Ensure response contains valid data
    if (!responseJson?.data?.products?.nodes) {
      throw new Error("Failed to fetch products");
    }

    // const products = responseJson.data.products.nodes;
    const products = [];

    // Fetch labels from Prisma
    const labels = await prisma.label.findMany({
      where: { shop: session.shop },
    });

    // Fetch product labels, including related label data
    const productLabels = await prisma.productLabel.findMany({
      where: { shop: session.shop },
      include: {
        label: true, // Ensure label fields are included
      },
    });

    // Filter out any product labels where the label might be null
    const validProductLabels = productLabels.filter((pl) => pl.label !== null);

    return json({ products, labels, productLabels: validProductLabels });
  } catch (error) {
    console.error("Loader error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const productId = formData.get("productId");

  if (action === "update_labels") {
    const selectedLabels = formData.getAll("labels");

    // Remove existing labels
    await prisma.productLabel.deleteMany({
      where: { productId, shop: session.shop },
    });

    // Add new labels
    for (const labelId of selectedLabels) {
      await prisma.productLabel.create({
        data: {
          productId,
          labelId,
          shop: session.shop,
        },
      });
    }
  }

  return null;
};

export default function ProductsPage() {
  const { products, labels, productLabels } = useLoaderData();
  const submit = useSubmit();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  }, []);

  const handleLabelUpdate = useCallback(
    (selectedLabels) => {
      const data = new FormData();
      data.append("action", "update_labels");
      data.append("productId", selectedProduct.id);
      selectedLabels.forEach((label) => data.append("labels", label));
      submit(data, { method: "post" });
      handleModalClose();
    },
    [selectedProduct, submit]
  );

  const getProductLabels = useCallback(
    (productId) => {
      return productLabels
        .filter((pl) => pl.productId === productId)
        .map((pl) => pl.label);
    },
    [productLabels]
  );

  return (
    <Page title="Products">
      <Layout>
        <Layout.Section>
          <Card>
            <Polaris.ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              items={products}
              renderItem={(product) => (
                <Polaris.ResourceItem
                  id={product.id}
                  accessibilityLabel={`View details for ${product.title}`}
                  name={product.title}
                >
                  <Polaris.Stack vertical>
                    <Polaris.Stack.Item>
                      <Polaris.Text variant="bodyMd" fontWeight="bold">
                        {product.title}
                      </Polaris.Text>
                    </Polaris.Stack.Item>
                  </Polaris.Stack>
                </Polaris.ResourceItem>
              )}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
