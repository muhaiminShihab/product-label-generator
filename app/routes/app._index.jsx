import { useEffect } from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  List,
  Link,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const totalLabels = await prisma.label.count({
    where: { shop: session.shop }
  });

  const labelsWithProducts = await prisma.label.findMany({
    where: { shop: session.shop },
    include: {
      _count: {
        select: { products: true }
      }
    }
  });

  const totalAssignedProducts = labelsWithProducts.reduce((sum, label) =>
    sum + label._count.products, 0
  );

  return json({ totalLabels, totalAssignedProducts, labelsWithProducts });
};

export default function Index() {
  const { totalLabels, totalAssignedProducts, labelsWithProducts } = useLoaderData();

  return (
    <Page title="Product Label Generator">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Banner
                title="Welcome to Product Label Generator"
                status="info"
              >
                <p>Organize and categorize your products with custom labels. Add visual indicators to your product pages.</p>
              </Banner>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Statistics</Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text>Total Labels Created:</Text>
                      <Text variant="headingLg">{totalLabels}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text>Total Product Assignments:</Text>
                      <Text variant="headingLg">{totalAssignedProducts}</Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">How to Use</Text>
                  <List type="number">
                    <List.Item>
                      Go to the Labels page to create and manage your product labels
                    </List.Item>
                    <List.Item>
                      Visit any product in your store to assign labels
                    </List.Item>
                    <List.Item>
                      Labels will automatically appear on your product pages
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Features</Text>
                  <List>
                    <List.Item>Create custom labels with colors</List.Item>
                    <List.Item>Assign multiple labels to products</List.Item>
                    <List.Item>Track products per label</List.Item>
                    <List.Item>Display labels on product pages</List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Quick Actions</Text>
                  <BlockStack gap="200">
                    <Button
                      primary
                      url="/app/labels"
                      fullWidth
                    >
                      Manage Labels
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" alignment="center" color="subdued">
                    Developed by Md Muhaiminul Islam Shihab
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
        <div style={{ height: "40px" }} />
      </BlockStack>
    </Page>
  );
}
