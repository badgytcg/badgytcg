import { notFound } from "next/navigation";
import { cards } from "@/data/cards";
import CardDetail from "./CardDetail";

export function generateStaticParams() {
  return cards.map((c) => ({ id: c.id }));
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = cards.find((c) => c.id === id);
  if (!card) notFound();
  return <CardDetail card={card} />;
}
