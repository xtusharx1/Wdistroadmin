// Amount still owed on an invoice: total minus payments minus issued credit notes
export const invoiceBalance = (inv) => {
  if (!inv) return 0
  const balance = (Number(inv.final_amount) || 0) - (Number(inv.total_paid_amount) || 0) - (Number(inv.total_credited_amount) || 0)
  return balance > 0.005 ? Math.round(balance * 100) / 100 : 0
}
