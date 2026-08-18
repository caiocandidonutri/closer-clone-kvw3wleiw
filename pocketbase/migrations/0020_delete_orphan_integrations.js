/// <reference path="../pb_data/types.d.ts" />
// Removes the two orphaned DISCONNECTED WhatsApp integrations that were left
// behind by stale Evolution API instances. The CONNECTED instance
// (ins_rmp1ubju, id b1smemmgdd3nhpp) is preserved.
//
// Deleted:
//   - 0kasbx74ax7y2eb  (ins_w7xq4olq, DISCONNECTED)
//   - rq5eaibdjffpn54  (ins_gwiozkl3, DISCONNECTED)

migrate(
  (app) => {
    app
      .db()
      .newQuery("DELETE FROM integrations WHERE id IN ('0kasbx74ax7y2eb', 'rq5eaibdjffpn54')")
      .execute()
  },
  (app) => {
    // No-op revert: the deleted orphan rows are stale and should not be
    // re-created. Rolling back this migration intentionally does nothing.
  },
)
