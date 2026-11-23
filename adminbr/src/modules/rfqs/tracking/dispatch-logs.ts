import { prisma } from "../../../infrastructure/db.js";
import { z } from "zod";
import { idSchema, pageInfo } from "../../../common/pagination/query.js";
export const logQuery = z.object({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(25).default(10)});
export async function dispatchLogs(rawId: unknown, rawQuery: unknown, client = prisma) {
  const id=idSchema.parse({id:rawId}).id,q=logQuery.parse(rawQuery);
  const [logs,total]=await Promise.all([client.rfqDispatchAttempt.findMany({where:{matchId:id},orderBy:[{requestedAt:"desc"},{id:"desc"}],take:q.pageSize,skip:(q.page-1)*q.pageSize,
    select:{id:true,kind:true,status:true,requestedAt:true,sentAt:true,deliveredAt:true,readAt:true,failureCode:true}}),client.rfqDispatchAttempt.count({where:{matchId:id}})]);
  return {logs,...pageInfo(total,q as any)};
}
