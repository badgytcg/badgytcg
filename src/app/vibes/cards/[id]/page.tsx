import { notFound } from "next/navigation";
import { getEffectiveCardById } from "@/lib/catalog";
import { marketSummary } from "@/lib/cardMarket";
import { recentSales, salesStats } from "@/lib/sales";
import CardDetail from "./CardDetail";

// Dynamic (not statically generated) so admin-edited stock/price always
// reflect the database without needing a redeploy.
export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getEffectiveCardById(id);
  if (!card) notFound();

  // Base id for market/sales lookups (strip any variant suffix).
  const baseId = id.replace(/::(foil|arctic|birb|pengu)$/, "");
  const [summary, stats, sales] = await Promise.all([
    marketSummary(baseId, "base"),
    salesStats(baseId),
    recentSales(baseId, 8),
  ]);

  return <CardDetail card={card} insights={{ summary, stats, sales }} />;
}
