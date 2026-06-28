import { getEffectiveCards } from "@/lib/catalog";
import PrintButton from "./PrintButton";

const SET_ORDER = ["Enter the Huddle", "Legend of the Lils", "Birb & Pengu"];

export const dynamic = "force-dynamic";

export default async function InventoryPrintPage() {
  const cards = await getEffectiveCards();
  const inStock = cards
    .filter((c) => c.stock > 0)
    .sort((a, b) => {
      const setDiff = SET_ORDER.indexOf(a.set) - SET_ORDER.indexOf(b.set);
      return setDiff !== 0 ? setDiff : a.name.localeCompare(b.name);
    });

  const totalUnits = inStock.reduce((s, c) => s + c.stock, 0);
  const totalValue = inStock.reduce((s, c) => s + c.price * c.stock, 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-zinc-100">Inventory Report</h1>
        <PrintButton />
      </div>

      <div className="text-black print:text-black">
        <h1 className="hidden text-xl font-bold print:mb-2 print:block">BadgyTCG Inventory Report</h1>
        <p className="mb-4 text-sm text-zinc-400 print:text-zinc-600">
          {inStock.length} card(s) in stock · {totalUnits} unit(s) total · Generated {new Date().toLocaleDateString()}
        </p>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400 print:border-black print:text-black">
              <th className="py-2 pr-2">Card</th>
              <th className="py-2 pr-2">Set</th>
              <th className="py-2 pr-2">Rarity</th>
              <th className="py-2 pr-2 text-right">Price</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {inStock.map((card) => (
              <tr key={card.id} className="border-b border-zinc-800 text-zinc-200 print:border-zinc-300 print:text-black">
                <td className="py-1.5 pr-2">{card.name}</td>
                <td className="py-1.5 pr-2 text-zinc-500 print:text-zinc-600">{card.set}</td>
                <td className="py-1.5 pr-2 text-zinc-500 print:text-zinc-600">{card.rarity}</td>
                <td className="py-1.5 pr-2 text-right">${card.price.toFixed(2)}</td>
                <td className="py-1.5 pr-2 text-right">{card.stock}</td>
                <td className="py-1.5 text-right">${(card.price * card.stock).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-600 font-semibold text-zinc-100 print:border-black print:text-black">
              <td className="py-3" colSpan={4}>Total</td>
              <td className="py-3 text-right">{totalUnits}</td>
              <td className="py-3 text-right">${totalValue.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
