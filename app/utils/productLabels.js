import prisma from "../db.server";

export async function getProductLabels(shop, productId) {
  const labels = await prisma.productLabel.findMany({
    where: { shop, productId },
    include: { label: true },
  });

  return labels.map((pl) => ({
    name: pl.label.name,
    color: pl.label.color,
    description: pl.label.description,
  }));
}
