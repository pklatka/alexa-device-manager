chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "fetchDevices":
            fetchDevices()
                .then(devices => sendResponse({ devices: devices }))
                .catch(err => sendResponse({ error: err.message }));
            return true;
        case "deleteDevice":
            deleteDevice(request.id)
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        case "renameDevice":
            renameDevice(request.id, request.name)
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        case "checkSignIn":
            const signedIn = !document.querySelector('a[href="/signin"]');
            sendResponse({ signedIn: signedIn });
            return true;
        default:
            return false;
    }
});

async function fetchDevices() {
    const queryPayload = {
        query: `query { endpoints { items { friendlyName legacyAppliance { applianceId entityId friendlyDescription }}} } `
    };
    const response = await fetch('/nexus/v1/graphql', {
        method: 'POST',
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(queryPayload)
    });
    if (!response.ok) throw new Error("Failed to fetch devices. Are you logged in?");
    const json = await response.json();
    return json.data?.endpoints?.items || [];
}

async function deleteDevice(applianceId) {
    const response = await fetch(`/api/phoenix/appliance/${encodeURIComponent(applianceId)}`, {
        method: "DELETE",
        headers: { "Accept": "application/json", "Content-Type": "application/json" }
    });
    if (!response.ok) throw new Error("Failed to delete device.");
    return true;
}

async function renameDevice(entityId, newName) {
    const response = await fetch("/api/phoenix/alias", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            friendlyName: newName,
            targetEntityId: entityId,
            targetEntityType: "APPLIANCE" // Assuming that for devices it's always APPLIANCE
        })
    });
    if (!response.ok) throw new Error("Failed to update device name.");
    return true;
}