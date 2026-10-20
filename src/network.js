const os = require("os");

function isPrivateIPv4(address) {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

function interfaceScore(name, address) {
  let score = 0;
  if (/vmware|virtualbox|vmnet|vethernet|hyper-v|docker|wsl|loopback|tailscale|zerotier/i.test(name)) {
    score -= 100;
  }
  if (/wlan|wi-?fi|wireless|ethernet|以太网|无线/i.test(name)) {
    score += 50;
  }
  if (isPrivateIPv4(address)) score += 20;
  if (address.startsWith("169.254.")) score -= 50;
  return score;
}

function getLanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const item of addresses || []) {
      if (item.family !== "IPv4" || item.internal) continue;
      candidates.push({
        address: item.address,
        score: interfaceScore(name, item.address)
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? candidates[0].address : null;
}

function getShareOrigin(req, options = {}) {
  const publicOrigin = options.publicOrigin || "";
  if (publicOrigin) return publicOrigin.replace(/\/+$/, "");

  const host = req.get("host") || "";
  const protocol =
    String(req.headers["x-forwarded-proto"] || req.protocol)
      .split(",")[0]
      .trim() || "http";

  let hostname = host;
  if (host.startsWith("[")) {
    hostname = host.slice(1, host.indexOf("]"));
  } else {
    hostname = host.split(":")[0];
  }

  const localNames = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
  if (host && !localNames.has(hostname.toLowerCase())) {
    return protocol + "://" + host;
  }

  const lanAddress = getLanAddress();
  if (!lanAddress) return req.protocol + "://" + host;
  const port = req.socket.localPort || options.fallbackPort || 3000;
  return protocol + "://" + lanAddress + ":" + port;
}

module.exports = { getLanAddress, getShareOrigin };
