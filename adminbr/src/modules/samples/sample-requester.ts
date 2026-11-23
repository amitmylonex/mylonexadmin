/** Safe requester view; administrative notes and actor IDs remain admin-only. */
export function requesterSample(sample:any) {
  return sample ? {...sample,quoteInternalNotes:null,quotedByUserId:null,rejectedByUserId:null,deliveredByUserId:null} : null;
}
