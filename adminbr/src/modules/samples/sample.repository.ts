import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db.js";
import { ListQuery, paging, pageInfo } from "../../common/pagination/query.js";
import { party } from "../rfqs/rfq.repository.js";
export const buyerSelect = {
  ...party,
  buyerProfile: { select: { company: true, phone: true, city: true } },
} as const;
export async function list(q: ListQuery, client = prisma) {
  const contains = { contains: q.search, mode: "insensitive" as const };
  const where: Prisma.SampleWhereInput = {
    ...(q.status === "delivered" ? {OR:[{status:"delivered"},{deliveredAt:{not:null}}]} : q.status === "accepted_by_buyer" ? {status:"accepted_by_buyer",deliveredAt:null} : q.status && q.status !== "all" ? {status:q.status} : {}),
    ...(q.search
      ? {
          AND: [{OR: [
            { sampleNumber: contains },
            { fabricName: contains },
            { buyer: { email: contains } },
          ]}],
        }
      : {}),
  };
  const [samples, total] = await Promise.all([
    client.sample.findMany({
      where,
      ...paging(q),
      include: { buyer: { select: buyerSelect }, order:{select:{id:true,orderNumber:true,status:true}} },
    }),
    client.sample.count({ where }),
  ]);
  const suppliers=samples.length?await client.supplierProfile.findMany({where:{id:{in:[...new Set(samples.map(s=>s.supplierId))]}},select:{id:true,companyName:true,status:true}}):[];
  return { samples:samples.map(sample=>({...sample,status:sample.deliveredAt?"delivered":sample.status,fulfillmentSupplier:suppliers.find(s=>s.id===sample.supplierId)||null})), ...pageInfo(total, q) };
}
export const find = (id: string, client = prisma) =>
  client.sample.findUnique({
    where: { id },
    include: { buyer: { select: buyerSelect }, order:{select:{id:true,orderNumber:true,status:true}} },
  });
export async function changeRequested(
  id: string,
  build: (row: any, tx: Prisma.TransactionClient) => Prisma.SampleUpdateManyMutationInput | Promise<Prisma.SampleUpdateManyMutationInput>,
  client = prisma,
) {
  return client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM public.samples WHERE id=${id} FOR UPDATE`;
    const sample = await tx.sample.findFirst({
      where: { id, status: "requested" },
    });
    if (!sample) return null;
    return tx.sample.updateMany({
      where: { id, status: "requested" },
      data: await build(sample,tx),
    });
  });
}
