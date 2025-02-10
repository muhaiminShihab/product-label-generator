import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Modal,
  FormLayout,
  TextField,
  Text,
  ButtonGroup,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Shop session not found", { status: 400 });
  }

  const labels = await prisma.label.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return json({ labels });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "create") {
    const name = formData.get("name");
    const color = formData.get("color");
    const description = formData.get("description");

    await prisma.label.create({
      data: {
        name,
        color,
        description,
        shop: session.shop,
      },
    });
  } else if (action === "delete") {
    const id = formData.get("id");
    await prisma.label.delete({
      where: { id },
    });
  }

  return null;
};

export default function LabelsPage() {
  const { labels } = useLoaderData();
  const submit = useSubmit();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#000000");
  const [description, setDescription] = useState("");

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setName("");
    setColor("#000000");
    setDescription("");
  }, []);

  const handleSubmit = useCallback(() => {
    const data = new FormData();
    data.append("action", "create");
    data.append("name", name);
    data.append("color", color);
    data.append("description", description);
    submit(data, { method: "post" });
    handleModalClose();
  }, [name, color, description, submit]);

  const handleDelete = useCallback((id) => {
    const data = new FormData();
    data.append("action", "delete");
    data.append("id", id);
    submit(data, { method: "post" });
  }, [submit]);

  const rows = labels.map((label) => [
    label.name,
    <div
      style={{
        backgroundColor: label.color,
        width: "24px",
        height: "24px",
        borderRadius: "4px",
      }}
    />,
    label.description || "-",
    <ButtonGroup>
      <Button
        destructive
        onClick={() => handleDelete(label.id)}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  return (
    <Page
      title="Product Labels"
      primaryAction={
        <Button primary onClick={() => setIsModalOpen(true)}>
          Create Label
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={["Name", "Color", "Description", "Actions"]}
              rows={rows}
              footerContent={
                rows.length === 0 ? (
                  <Text as="p" alignment="center">
                    No labels found. Create one to get started.
                  </Text>
                ) : null
              }
            />
          </Card>
        </Layout.Section>

        <Modal
          open={isModalOpen}
          onClose={handleModalClose}
          title="Create New Label"
          primaryAction={{
            content: "Create",
            onAction: handleSubmit,
          }}
          secondaryActions={[{
            content: "Cancel",
            onAction: handleModalClose,
          }]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Name"
                value={name}
                onChange={setName}
                autoComplete="off"
                required
              />
              <TextField
                label="Color"
                value={color}
                onChange={setColor}
                type="color"
                required
              />
              <TextField
                label="Description"
                value={description}
                onChange={setDescription}
                multiline={3}
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      </Layout>
    </Page>
  );
}
