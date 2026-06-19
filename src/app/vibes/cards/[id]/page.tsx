import { notFound } from "next/navigation";
import { getEffectiveCardById } from "@/lib/catalog";
import CardDetail from "./CardDetail";

// Dynamic (not statically generated) so admin-edited stock/price always
// reflect the database without needing a redeploy.
export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getEffectiveCardById(id);
  if (!card) notFound();
  return <CardDetail card={card} />;
}
