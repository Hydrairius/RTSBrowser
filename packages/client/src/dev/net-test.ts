/** Multiplayer auth + sync test harness — open with ?dev=net */
import { fetchMe, login, logout, register } from "../api.js";
import { NetTestClient } from "../net-client.js";

const app = document.getElementById("app")!;

let net: NetTestClient | null = null;

function renderAuth(user: { email: string } | null): void {
  const authPanel = document.getElementById("auth-panel")!;
  const gamePanel = document.getElementById("game-panel")!;

  if (user) {
    authPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
    (document.getElementById("user-label") as HTMLElement).textContent = user.email;
  } else {
    authPanel.classList.remove("hidden");
    gamePanel.classList.add("hidden");
  }
}

export async function bootNetTest(): Promise<void> {
  document.body.classList.add("dev-net");
  app.innerHTML = `
    <h1>RTSBrowser</h1>
    <p class="sub">Auth + networking test — AI commands are generated on the server and replayed on every client.</p>
    <p class="sub"><a href="/">← Back to game</a></p>

    <section id="auth-panel" class="panel">
      <h2>Account</h2>
      <label>Email</label>
      <input id="email" type="email" autocomplete="username" />
      <label>Password (min 8)</label>
      <input id="password" type="password" autocomplete="current-password" />
      <div class="row">
        <button id="btn-register">Create account</button>
        <button id="btn-login" class="secondary">Log in</button>
      </div>
      <p id="auth-status" class="status"></p>
    </section>

    <section id="game-panel" class="panel hidden">
      <h2>Session</h2>
      <p>Signed in as <strong id="user-label"></strong> <button id="btn-logout" class="secondary">Log out</button></p>

      <h2>Room</h2>
      <label>Display name</label>
      <input id="display-name" value="Commander" />
      <label>Room ID (leave empty to create)</label>
      <input id="room-id" placeholder="abc12345" />
      <div class="row">
        <button id="btn-connect">Connect WebSocket</button>
        <button id="btn-room" class="secondary">Create / join room</button>
      </div>

      <h2>Commands</h2>
      <div class="row">
        <button id="btn-up">Move ↑</button>
        <button id="btn-down">Move ↓</button>
        <button id="btn-left">Move ←</button>
        <button id="btn-right">Move →</button>
      </div>

      <h2>Sync</h2>
      <p id="net-status" class="status">Not connected.</p>
      <table>
        <thead><tr><th>Player</th><th>Type</th><th>X</th><th>Y</th></tr></thead>
        <tbody id="players-body"></tbody>
      </table>
    </section>
  `;

  document.getElementById("btn-register")!.onclick = async () => {
    const status = document.getElementById("auth-status")!;
    const result = await register(
      (document.getElementById("email") as HTMLInputElement).value,
      (document.getElementById("password") as HTMLInputElement).value,
    );
    if (typeof result === "string") {
      status.textContent = result;
      status.className = "status err";
      return;
    }
    status.textContent = "Account created.";
    status.className = "status ok";
    renderAuth(result.user);
  };

  document.getElementById("btn-login")!.onclick = async () => {
    const status = document.getElementById("auth-status")!;
    const result = await login(
      (document.getElementById("email") as HTMLInputElement).value,
      (document.getElementById("password") as HTMLInputElement).value,
    );
    if (typeof result === "string") {
      status.textContent = result;
      status.className = "status err";
      return;
    }
    status.textContent = "Logged in.";
    status.className = "status ok";
    renderAuth(result.user);
  };

  document.getElementById("btn-logout")!.onclick = () => {
    net?.disconnect();
    net = null;
    logout();
    renderAuth(null);
  };

  const setNetStatus = (text: string, level?: "ok" | "warn" | "err") => {
    const el = document.getElementById("net-status")!;
    el.textContent = text;
    el.className = `status ${level ?? ""}`;
  };

  document.getElementById("btn-connect")!.onclick = () => {
    net?.disconnect();
    net = new NetTestClient({
      onStatus: setNetStatus,
      onRoom: (roomId, playerId) => {
        setNetStatus(`Room ${roomId} · you are ${playerId}`, "ok");
      },
      onTurn: (tick, local, server, inSync) => {
        setNetStatus(
          `Tick ${tick} · hash ${inSync ? "✓ in sync" : `✗ local ${local} vs server ${server}`}`,
          inSync ? "ok" : "err",
        );
      },
      onPlayers: (rows) => {
        const body = document.getElementById("players-body")!;
        body.innerHTML = rows
          .map(
            (r) =>
              `<tr><td>${r.name}</td><td><span class="badge ${r.kind}">${r.kind}</span></td><td>${r.x}</td><td>${r.y}</td></tr>`,
          )
          .join("");
      },
    });
    net.connect();
  };

  document.getElementById("btn-room")!.onclick = () => {
    if (!net) {
      setNetStatus("Connect WebSocket first.", "err");
      return;
    }
    const name = (document.getElementById("display-name") as HTMLInputElement).value;
    const roomId = (document.getElementById("room-id") as HTMLInputElement).value;
    if (roomId) net.joinRoom(roomId, name);
    else net.createRoom(name);
  };

  const move = (dx: number, dy: number) => net?.move(dx, dy);
  document.getElementById("btn-up")!.onclick = () => move(0, -1);
  document.getElementById("btn-down")!.onclick = () => move(0, 1);
  document.getElementById("btn-left")!.onclick = () => move(-1, 0);
  document.getElementById("btn-right")!.onclick = () => move(1, 0);

  const user = await fetchMe();
  renderAuth(user);
}
