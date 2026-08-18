/// <reference path="../pb_data/types.d.ts" />
// Makes subscription_plans publicly readable (list/view) so the public landing
// page (logged-out visitors) can fetch the API-generated InfinitePay links.
// create/update/delete still require an authenticated user.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('subscription_plans')
    col.listRule = ''
    col.viewRule = ''
    col.createRule = '@request.auth.id != ""'
    col.updateRule = '@request.auth.id != ""'
    col.deleteRule = '@request.auth.id != ""'
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('subscription_plans')
    col.listRule = '@request.auth.id != ""'
    col.viewRule = '@request.auth.id != ""'
    app.save(col)
  },
)
