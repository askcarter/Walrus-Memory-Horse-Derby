/**
 * Sanity-check your .env.local before hitting the relayer.
 *
 * Run with:  pnpm tsx verify.ts
 *
 * Prints the public key + Sui address derived from MEMWAL_PRIVATE_KEY. Compare these
 * to what the staging.memwal.ai (or memwal.ai) dashboard shows for your
 * delegate key. If they don't match, you pasted the wrong string into
 * MEMWAL_PRIVATE_KEY.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPublicKeyAsync } from "@noble/ed25519";
import { blake2b } from "@noble/hashes/blake2.js";

function loadEnvLocal(): Record<string, string> {
    try {
        const raw = readFileSync(resolve(".env.local"), "utf8");
        const out: Record<string, string> = {};
        for (const line of raw.split("\n")) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (!m) continue;
            out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
        }
        return out;
    } catch {
        return {};
    }
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (clean.length % 2 !== 0) throw new Error("hex string has odd length");
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function bytesToHex(b: Uint8Array): string {
    return Array.from(b)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
}

async function main() {
    const env = { ...loadEnvLocal(), ...process.env };
    const key = env.MEMWAL_PRIVATE_KEY;
    const accountId = env.MEMWAL_ACCOUNT_ID;
    const serverUrl = env.MEMWAL_SERVER_URL ?? "(default: https://relayer.memwal.ai)";

    console.log("── workshop-kit env check ──");
    console.log("MEMWAL_PRIVATE_KEY        :", key ? `${key.slice(0, 8)}…${key.slice(-4)} (${key.length} chars)` : "MISSING");
    console.log("MEMWAL_ACCOUNT_ID :", accountId ?? "MISSING");
    console.log("MEMWAL_SERVER_URL :", serverUrl);
    console.log();

    if (!key) {
        console.error("✗ MEMWAL_PRIVATE_KEY is not set in .env.local");
        process.exit(1);
    }
    if (key.length !== 64) {
        console.error(`✗ MEMWAL_PRIVATE_KEY is ${key.length} hex chars; expected exactly 64 (32 bytes). Did you paste the wrong string?`);
        process.exit(1);
    }

    let keyBytes: Uint8Array;
    try {
        keyBytes = hexToBytes(key);
    } catch (e) {
        console.error("✗ MEMWAL_PRIVATE_KEY is not valid hex:", e);
        process.exit(1);
    }

    const pubKey = await getPublicKeyAsync(keyBytes);
    const pubHex = bytesToHex(pubKey);

    // Derive Sui address: blake2b-256(0x00 || pubkey)
    const input = new Uint8Array(33);
    input[0] = 0x00;
    input.set(pubKey, 1);
    const suiAddr = "0x" + bytesToHex(blake2b(input, { dkLen: 32 }));

    console.log("Derived from your MEMWAL_PRIVATE_KEY (treating it as a private key):");
    console.log("  public key  :", pubHex);
    console.log("  sui address :", suiAddr);
    console.log();
    console.log("Compare the public key above with the public key shown in the");
    console.log("staging.memwal.ai dashboard for your delegate key.");
    console.log();
    console.log("• match → MEMWAL_PRIVATE_KEY is correct. 401 is something else");
    console.log("  (wrong account ID, dev server not restarted, key not yet on-chain).");
    console.log("• mismatch → you pasted the PUBLIC key into MEMWAL_PRIVATE_KEY by mistake.");
    console.log("  Open the dashboard and copy the PRIVATE key instead.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
