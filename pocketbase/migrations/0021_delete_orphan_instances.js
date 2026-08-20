/// <reference path="../pb_data/types.d.ts" />
// Removes the two orphaned DISCONNECTED WhatsApp integrations:
//   - vdrxdpbn1ibvh8p (ins_zdka63yo, DISCONNECTED)
//   - 2clllal02mz44l7 (ins_2u25h1lz, DISCONNECTED)
// The CONNECTED instance (ins_rmp1ubju, id b1smemmgdd3nhpp) is preserved.

migrate(
  (app) => {
    app
      .db()
      .newQuery("DELETE FROM integrations WHERE id IN ('vdrxdpbn1ibvh8p', '2clllal02mz44l7')")
      .execute()
  },
  (app) => {
    // No-op revert: the deleted orphan rows are stale and should not be re-created.
  },
)
