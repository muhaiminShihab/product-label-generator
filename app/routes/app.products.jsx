// Remove the individual imports and keep the namespace import
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import * as Polaris from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (!admin || !session?.shop) {
      throw new Error("Unauthorized or invalid session");
    }

    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("searchTerm") || "";

    const response = await admin.graphql(`
      query {
        products(first: 10, query: "${searchTerm}") {
          nodes {
            id
            title
            images(first: 1) {
              nodes {
                url
              }
            }
            status
            updatedAt
          }
        }
      }
    `);

    const responseJson = await response.json();
    const products = responseJson.data?.products?.nodes || [];

    const labels = await prisma.label.findMany({
      where: { shop: session.shop },
    });

    const productLabels = await prisma.productLabel.findMany({
      where: { shop: session.shop },
      include: {
        label: true,
      },
    });

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
  const { products = [], labels = [], productLabels = [] } = useLoaderData();
  const submit = useSubmit();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Remove this line as we're now importing Page directly
  // const { Page } = Polaris;

  const [selectedLabels, setSelectedLabels] = useState([]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setSelectedLabels([]); // Reset selected labels when closing
  }, []);

  // Update this handler to use the selectedLabels state
  const handleLabelUpdate = useCallback(
    (selectedLabelIds) => {
      const data = new FormData();
      data.append("action", "update_labels");
      data.append("productId", selectedProduct.id);
      selectedLabelIds.forEach((labelId) => data.append("labels", labelId));
      submit(data, { method: "post" });
      handleModalClose();
    },
    [selectedProduct, submit, handleModalClose]
  );

  const getProductLabels = useCallback(
    (productId) => {
      return productLabels
        .filter((pl) => pl.productId === productId)
        .map((pl) => pl.label);
    },
    [productLabels]
  );

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    submit({ searchTerm: value }, { method: "get" });
  }, [submit]);

  const rows = (products || []).map((product) => [
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {product.images?.nodes[0]?.url && (
        <Polaris.Thumbnail
          source={product.images.nodes[0].url}
          alt={product.title}
          size="small"
        />
      )}
      <Polaris.Text variant="bodyMd" fontWeight="bold">
        {product.title}
      </Polaris.Text>
    </div>,
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {getProductLabels(product.id).map((label) => (
        <span
          key={label.id}
          style={{
            backgroundColor: label.color,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#fff',
          }}
        >
          {label.name}
        </span>
      ))}
    </div>,
    <Polaris.ButtonGroup>
      // In your rows mapping where you set up the Manage labels button
      <Polaris.Button
        onClick={() => {
          setSelectedProduct(product);
          setSelectedLabels(getProductLabels(product.id).map(label => label.id));
          setIsModalOpen(true);
        }}
      >
        Manage labels
      </Polaris.Button>
    </Polaris.ButtonGroup>,
  ]);

  return (
    <Polaris.Page title="Products">
      <Polaris.Layout>
        <Polaris.Layout.Section>
          <Polaris.Card>
            <div style={{ padding: "16px" }}>
              <Polaris.TextField
                label="Search products"
                value={searchTerm}
                onChange={handleSearchChange}
                autoComplete="off"
                placeholder="Search by product title..."
                prefix={<Polaris.Icon source={Polaris.SearchMinor} />}
                clearButton
                onClearButtonClick={() => handleSearchChange("")}
              />
            </div>
            <Polaris.DataTable
              columnContentTypes={["text", "text", "text"]}
              headings={["Product", "Labels", "Actions"]}
              rows={rows}
              footerContent={
                rows.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <Polaris.Text color="subdued">
                      No products found
                    </Polaris.Text>
                  </div>
                ) : null
              }
            />
          </Polaris.Card>
        </Polaris.Layout.Section>
      </Polaris.Layout>

      <Polaris.Modal
        open={isModalOpen}
        onClose={handleModalClose}
        title={`Manage labels for ${selectedProduct?.title}`}
        primaryAction={{
          content: "Save",
          onAction: () => handleLabelUpdate(selectedLabels),
        }}
        secondaryActions={[{
          content: "Cancel",
          onAction: handleModalClose,
        }]}
      >
        <Polaris.Modal.Section>
          <Polaris.ChoiceList
            allowMultiple
            title="Select labels"
            choices={labels.map(label => ({
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      backgroundColor: label.color,
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                    }}
                  />
                  {label.name}
                </div>
              ),
              value: label.id,
            }))}
            selected={selectedLabels}
            onChange={setSelectedLabels}
            name="labels"
          />
        </Polaris.Modal.Section>
      </Polaris.Modal>
    </Polaris.Page>
  );
}
