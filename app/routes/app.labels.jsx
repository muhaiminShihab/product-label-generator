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
    include: {
      _count: {
        select: { products: true }
      }
    }
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
  } else if (action === "edit") {
    const id = formData.get("id");
    const name = formData.get("name");
    const color = formData.get("color");
    const description = formData.get("description");

    await prisma.label.update({
      where: { id },
      data: { name, color, description },
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
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelToDelete, setLabelToDelete] = useState(null);

  const handleDelete = useCallback((id) => {
    const data = new FormData();
    data.append("action", "delete");
    data.append("id", id);
    submit(data, { method: "post" });
    setLabelToDelete(null);
  }, [submit]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setName("");
    setColor("#000000");
    setDescription("");
    setEditingLabel(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const data = new FormData();
    data.append("action", editingLabel ? "edit" : "create");
    data.append("name", name);
    data.append("color", color);
    data.append("description", description);
    if (editingLabel) {
      data.append("id", editingLabel.id);
    }
    submit(data, { method: "post" });
    handleModalClose();
  }, [name, color, description, editingLabel, submit, handleModalClose]);

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
    label._count.products,
    <ButtonGroup>
      <Button onClick={() => handleEdit(label)}>Edit</Button>
      <Button destructive onClick={() => setLabelToDelete(label)}>
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  const handleEdit = useCallback((label) => {
    setName(label.name);
    setColor(label.color);
    setDescription(label.description || "");
    setEditingLabel(label);
    setIsModalOpen(true);
  }, []);

  return (
    <Page
      title="Labels"
      primaryAction={{
        content: "Add Label",
        onAction: () => setIsModalOpen(true),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "text", "text", "numeric", "text"]}
              headings={["Name", "Color", "Description", "Products", "Actions"]}
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

        {/* Edit/Create Modal */}
        <Modal
          open={isModalOpen}
          onClose={handleModalClose}
          title={editingLabel ? "Edit Label" : "Create New Label"}
          primaryAction={{
            content: editingLabel ? "Save" : "Create",
            onAction: handleSubmit,
            disabled: !name || !color,
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
                error={name.length === 0 ? "Name is required" : undefined}
              />
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Color Code"
                    value={color}
                    onChange={(value) => {
                      if (value.match(/^#([0-9A-F]{3}){1,2}$/i)) {
                        setColor(value);
                      } else if (value.startsWith('#') || value === '') {
                        setColor(value);
                      }
                    }}
                    autoComplete="off"
                    required
                    error={color.length === 0 ? "Color is required" : undefined}
                  />
                </div>
                <TextField
                  label="Color Picker"
                  type="color"
                  value={color.match(/^#([0-9A-F]{3}){1,2}$/i) ? color : '#000000'}
                  onChange={setColor}
                  required
                />
              </div>
              <TextField
                label="Description"
                value={description}
                onChange={setDescription}
                multiline={3}
              />
            </FormLayout>
          </Modal.Section>
        </Modal>

        {/* Add Delete Confirmation Modal */}
        <Modal
          open={labelToDelete !== null}
          onClose={() => setLabelToDelete(null)}
          title="Delete Label"
          primaryAction={{
            content: "Delete",
            onAction: () => handleDelete(labelToDelete?.id),
            destructive: true,
          }}
          secondaryActions={[{
            content: "Cancel",
            onAction: () => setLabelToDelete(null),
          }]}
        >
          <Modal.Section>
            <Text>
              Are you sure you want to delete the label "{labelToDelete?.name}"? This action cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>
      </Layout>
    </Page>
  );
}
