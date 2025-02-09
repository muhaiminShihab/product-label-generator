import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import * as Polaris from '@shopify/polaris';
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              handle
            }
          }
        }
      }
    `
  );

  const { data } = await response.json();
  const products = data.products.edges.map(({ node }) => node);

  const labels = await prisma.label.findMany({
    where: { shop: session.shop },
  });

  const productLabels = await prisma.productLabel.findMany({
    where: { shop: session.shop },
    include: {
      label: true  // Include all label fields
    },
  });

  // Filter out any product labels where the label might be null
  const validProductLabels = productLabels.filter(pl => pl.label !== null);

  return json({ products, labels, productLabels: validProductLabels });
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
            <ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              items={products}
              renderItem={(product) => {
                const productLabels = getProductLabels(product.id);

                return (
                  <ResourceItem
                    id={product.id}
                    accessibilityLabel={`View details for ${product.title}`}
                    name={product.title}
                  >
                    <Stack vertical>
                      <Stack.Item>
                        <Text variant="bodyMd" fontWeight="bold">
                          {product.title}
                        </Text>
                      </Stack.Item>
                      <Stack.Item>
                        <Stack spacing="tight">
                          {productLabels.map((label) => (
                            <Tag key={label.id}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "2px",
                                    backgroundColor: label.color,
                                  }}
                                />
                                {label.name}
                              </div>
                            </Tag>
                          ))}
                        </Stack>
                      </Stack.Item>
                      <Stack.Item>
                        <Button
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsModalOpen(true);
                          }}
                        >
                          Manage Labels
                        </Button>
                      </Stack.Item>
                    </Stack>
                  </ResourceItem>
                );
              }}
            />
          </Card>
        </Layout.Section>

        {selectedProduct && (
          <Modal
            open={isModalOpen}
            onClose={handleModalClose}
            title={`Manage Labels - ${selectedProduct.title}`}
            primaryAction={{
              content: "Save",
              onAction: (selectedLabels) => handleLabelUpdate(selectedLabels),
            }}
            secondaryActions={[{
              content: "Cancel",
              onAction: handleModalClose,
            }]}
          >
            <Modal.Section>
              <FormLayout>
                <ChoiceList
                  allowMultiple
                  title="Labels"
                  choices={labels.map((label) => ({
                    label: (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            backgroundColor: label.color,
                          }}
                        />
                        <span>{label.name}</span>
                      </div>
                    ),
                    value: label.id,
                  }))}
                  selected={getProductLabels(selectedProduct.id).map(
                    (label) => label.id
                  )}
                  onChange={handleLabelUpdate}
                />
              </FormLayout>
            </Modal.Section>
          </Modal>
        )}
      </Layout>
    </Page>
  );
}
