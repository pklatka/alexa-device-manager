document.addEventListener("DOMContentLoaded", () => {
    const statusEl = document.getElementById("status");
    const deviceListEl = document.getElementById("device-list");
    const deleteAllBtn = document.getElementById("delete-all-btn");
    const refreshBtn = document.getElementById("refresh-btn");

    let currentTabId = null;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        currentTabId = activeTab.id;

        if (!activeTab.url.includes("alexa.amazon.com")) {
            statusEl.innerHTML = `<span class="error">Please navigate to <a href="https://alexa.amazon.com" target="_blank">alexa.amazon.com</a> to manage your devices.</span>`;
            return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "checkSignIn" }, (response) => {
            if (response && response.signedIn === false) {
                statusEl.innerHTML = `<span class="error">Please sign in to your Amazon account to manage your devices.</span>`;
                return;
            }

            refreshBtn.disabled = false;
            loadDevices();
        });
    });

    function loadDevices() {
        statusEl.innerText = "Fetching devices...";
        deleteAllBtn.disabled = true;

        chrome.tabs.sendMessage(currentTabId, { action: "fetchDevices" }, (response) => {
            if (chrome.runtime.lastError || !response) {
                statusEl.innerHTML = `<span class="error">Error connecting. Try refreshing the page.</span>`;
                return;
            }
            if (response.error) {
                statusEl.innerHTML = `<span class="error">${response.error}</span>`;
                return;
            }

            const devices = response.devices;
            if (!devices || devices.length === 0) {
                statusEl.innerText = "No devices found.";
                return;
            }

            statusEl.innerText = `Found ${devices.length} devices.`;
            renderDevices(devices, currentTabId);
            deleteAllBtn.disabled = false;
        });
    }

    refreshBtn.addEventListener("click", () => loadDevices());

    function renderDevices(devices, tabId) {
        deviceListEl.innerHTML = "";
        devices.forEach((device) => {
            const applianceId = device.legacyAppliance?.applianceId;
            const entityId = device.legacyAppliance?.entityId;
            const description = device.legacyAppliance?.friendlyDescription || "";
            if (!applianceId || !entityId) return;

            const card = document.createElement("div");
            card.className = "device-card";

            // Input field for renaming
            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.className = "device-name-input";
            nameInput.value = device.friendlyName || "Unknown Device";
            nameInput.disabled = true;

            const actionsContainer = document.createElement("div");
            actionsContainer.className = "actions";

            // Edit/Save Button
            const editBtn = document.createElement("button");
            editBtn.className = "action-btn edit-btn";
            editBtn.innerText = "Rename";

            // Delete Button
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "action-btn delete-btn";
            deleteBtn.innerText = "Delete";

            editBtn.onclick = () => {
                if (editBtn.innerText === "Rename") {
                    nameInput.disabled = false;
                    nameInput.focus();
                    editBtn.innerText = "Save";
                } else {
                    nameInput.disabled = true;
                    editBtn.innerText = "Saving...";
                    renameDeviceCall(entityId, nameInput.value, editBtn, tabId);
                }
            };

            deleteBtn.onclick = () => deleteDevice(applianceId, deleteBtn, card, tabId);

            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(deleteBtn);

            const infoRow = document.createElement("div");
            infoRow.className = "device-info";

            if (description) {
                const descSpan = document.createElement("span");
                descSpan.className = "device-description";
                descSpan.textContent = description;
                infoRow.appendChild(descSpan);
            }

            const topRow = document.createElement("div");
            topRow.className = "device-top-row";
            topRow.appendChild(nameInput);
            topRow.appendChild(actionsContainer);

            card.appendChild(topRow);
            if (infoRow.children.length > 0) card.appendChild(infoRow);
            deviceListEl.appendChild(card);
        });
    }

    function renameDeviceCall(entityId, newName, btnElement, tabId) {
        chrome.tabs.sendMessage(tabId, { action: "renameDevice", id: entityId, name: newName }, (response) => {
            if (response && response.success) {
                btnElement.innerText = "Rename";
            } else {
                btnElement.innerText = "Failed";
                setTimeout(() => { btnElement.innerText = "Rename"; }, 2000);
            }
        });
    }

    function deleteDevice(applianceId, btnElement, cardElement, tabId) {
        return new Promise((resolve) => {
            btnElement.disabled = true;
            btnElement.innerText = "Deleting...";

            chrome.tabs.sendMessage(tabId, { action: "deleteDevice", id: applianceId }, (response) => {
                if (response && response.success) {
                    cardElement.style.opacity = "0.5";
                    cardElement.querySelector('.edit-btn').disabled = true;
                    cardElement.querySelector('.device-name-input').disabled = true;
                    btnElement.innerText = "Deleted";
                    resolve(true);
                } else {
                    btnElement.disabled = false;
                    btnElement.innerText = "Failed (Retry)";
                    resolve(false);
                }
            });
        });
    }

    deleteAllBtn.addEventListener("click", async () => {
        const isConfirmed = confirm("Are you sure you want to delete ALL devices listed below? This action cannot be undone.");
        if (!isConfirmed) return;

        deleteAllBtn.disabled = true;
        deleteAllBtn.innerText = "Processing...";

        const allDeleteButtons = document.querySelectorAll('.delete-btn:not(:disabled)');
        for (const btn of allDeleteButtons) {
            btn.click();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        deleteAllBtn.innerText = "Finished";
    });
});