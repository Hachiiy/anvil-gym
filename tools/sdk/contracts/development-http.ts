const routes = {
startAppDevelopmentPairing: {
    method: "POST",
    path: "v3/app-development/client/pairings",
    status: 201,
    authentication: "app-development",
  },
appDevelopmentPairingClient: {
    method: "GET",
    path: "v3/app-development/client/pairings/:id",
    status: 200,
    authentication: "app-development",
  },
exchangeAppDevelopmentPairing: {
    method: "POST",
    path: "v3/app-development/client/pairings/:id/exchange",
    status: 200,
    authentication: "app-development",
  },
recoverAppDevelopmentPairing: {
    method: "GET",
    path: "v3/app-development/client/pairings/:id/preview",
    status: 200,
    authentication: "app-development",
  },
pairedAppPreview: {
    method: "GET",
    path: "v3/app-development/client/previews/:id",
    status: 200,
    authentication: "app-development",
  },
uploadAppPreview: {
    method: "PUT",
    path: "v3/app-development/client/previews/:id/package",
    status: 200,
    binary: "upload",
    authentication: "app-development",
  },
executePairedAppPreviewAction: {
    method: "POST",
    path: "v3/app-development/client/previews/:id/actions",
    status: 200,
    authentication: "app-development",
  },
pairedAppPreviewActionReceipt: {
    method: "POST",
    path: "v3/app-development/client/previews/:id/action-receipts",
    status: 200,
    authentication: "app-development",
  }
} as const;
export function browserHttpRoute(operation: keyof typeof routes) { return routes[operation]; }
