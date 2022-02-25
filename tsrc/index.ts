import Schema from "validate";

const ZeroArraySchema = { type: Number, size: { min: 0, max: 24 }, required: true };
const OneArraySchema = { type: Number, size: { min: 1, max: 25 }, required: true };

export const BattleTagRegex =
  /(^([A-zÀ-ú][A-zÀ-ú0-9]{2,11})|(^([а-яёА-ЯЁÀ-ú][а-яёА-ЯЁ0-9À-ú]{2,11})))(#[0-9]{4,8})$/;

export const ChatMessageSchema = new Schema({
  name: { type: String, match: BattleTagRegex, required: true },
  message: { type: String, length: { min: 1, max: 255 }, required: true },
  time: { type: Number, length: { min: 0, max: Number.MAX_SAFE_INTEGER } },
});

export const ExtraDataSchema = new Schema({
  played: Number,
  wins: Number,
  losses: Number,
  rating: Number,
  lastChange: Number,
  rank: Number,
});

export const PlayerPayloadSchema = new Schema({
  slotStatus: { type: Number, size: { min: 0, max: 3 }, required: true },
  slot: ZeroArraySchema,
  team: ZeroArraySchema,
  slotType: { type: Number, size: { min: 0, max: 1 }, required: true },
  isObserver: { type: Boolean, required: true },
  isSelf: { type: Boolean, required: true },
  slotTypeChangeEnabled: { type: Boolean, required: true },
  id: { type: Number, size: { min: 0, max: 255 }, required: true },
  name: { type: String, length: { min: 0, max: 32 } },
  playerRegion: { type: String, enum: ["us", "eu", "usw", ""] },
  playerGateway: { type: Number, required: true },
  color: ZeroArraySchema,
  colorChangeEnabled: { type: Boolean, required: true },
  teamChangeEnabled: { type: Boolean, required: true },
  race: { type: Number, size: { min: 0, max: 32 }, required: true },
  raceChangeEnabled: { type: Boolean, required: true },
  handicap: { type: Number, size: { min: 50, max: 100 }, required: true },
  handicapChangeEnabled: { type: Boolean, required: true },
});

const GameClientLobbyPayloadStaticSchema = {
  isHost: { type: Boolean, required: true },
  playerHost: {
    type: String,
    match: BattleTagRegex,
    required: true,
  },
  maxTeams: { type: Number, size: { min: 1, max: 24 }, required: true },
  isCustomForces: { type: Boolean, required: true },
  isCustomPlayers: { type: Boolean, required: true },
  mapData: {
    mapSize: {
      type: String,
      length: { min: 4, max: 32 },
      required: true,
    },
    mapSpeed: { type: String, length: { min: 4, max: 32 }, required: true },
    mapName: { type: String, length: { min: 2, max: 48 }, required: true },
    mapPath: { type: String, length: { min: 4, max: 127 }, required: true },
    mapAuthor: { type: String, length: { min: 1, max: 32 }, required: true },
    description: { type: String, length: { min: 1, max: 255 }, required: true },
    suggested_players: { type: String, length: { min: 1, max: 32 }, required: true },
  },
  lobbyName: { type: String, length: { min: 1, max: 32 }, required: true },
  mapFlags: {
    flagLockTeams: { type: Boolean, required: true },
    flagPlaceTeamsTogether: { type: Boolean, required: true },
    flagFullSharedUnitControl: { type: Boolean, required: true },
    flagRandomRaces: { type: Boolean, required: true },
    flagRandomHero: { type: Boolean, required: true },
    settingObservers: {
      type: String,
      enum: ["No Observers", "Observers on Defeat", "Referees", "Full Observers"],
      required: true,
    },
    typeObservers: { type: Number, required: true },
    settingVisibility: {
      type: String,
      enum: ["Default", "Hide Terrain", "Map Explored", "Always Visible"],
      required: true,
    },
    typeVisibility: { type: Number, size: { min: 0, max: 3 }, required: true },
  },
};

export const GameClientLobbyPayloadSchema = new Schema({
  teamData: {
    teams: [
      {
        name: { type: String, length: { min: 1, max: 32 }, required: true },
        team: ZeroArraySchema,
        filledSlots: ZeroArraySchema,
        totalSlots: OneArraySchema,
      },
    ],
    playableSlots: ZeroArraySchema,
    filledPlayableSlots: OneArraySchema,
    observerSlotsRemaining: ZeroArraySchema,
  },
  players: [PlayerPayloadSchema],
  ...GameClientLobbyPayloadStaticSchema,
});

export class MicroLobby {
  lookupName: string;
  region: MicroLobbyData["region"];
  slots: MicroLobbyData["slots"] = {};
  lobbyStatic: MicroLobbyData["lobbyStatic"];
  teamListLookup: MicroLobbyData["teamListLookup"] = {};
  chatMessages: MicroLobbyData["chatMessages"] = [];
  #playerData: MicroLobbyData["playerData"] = {};
  allPlayers: Array<string> = [];
  nonSpecPlayers: Array<string> = [];
  statsAvailable: boolean = false;
  log: boolean = true;

  constructor(
    data: {
      region?: Regions;
      payload?: GameClientLobbyPayload;
      fullData?: MicroLobbyData;
    },
    log: boolean = true
  ) {
    this.log = log;
    if (data.payload) {
      // Check the region
      if (!data.region || !["us", "eu", "usw"].includes(data.region)) {
        throw new Error("Invalid region");
      }
      // Check all the static data
      const dataTest = GameClientLobbyPayloadSchema.validate(data.payload);
      if (dataTest.length > 0) {
        dataTest.forEach((error) => {
          console.error(
            error.path,
            // @ts-ignore
            error.message
          );
        });
        throw new Error("Invalid Data: " + Object.entries(dataTest[0]).join(", "));
      }
      if (Object.values(data.payload.players).find((slot) => slot.isSelf) !== undefined) {
        let { teamData, availableTeamColors, players, ...lobbyStatic } = data.payload;
        this.lobbyStatic = lobbyStatic;
        this.region = data.region;
        for (const team of data.payload.teamData.teams) {
          const teamName = team.name;
          let teamType: TeamTypes = "playerTeams";
          let players = data.payload.players.filter(
            (player) => player.team === team.team
          );
          if (this.lobbyStatic.isHost) {
            if (players.filter((player) => player.isObserver).length > 0) {
              teamType = "specTeams";
            } else if (
              players.filter((player) => player.slotTypeChangeEnabled).length === 0
            ) {
              teamType = "otherTeams";
            } else if (this.testTeam(teamName) === "specTeams") {
              teamType = "specTeams";
            }
          } else {
            if (players.filter((player) => player.isObserver).length > 0) {
              teamType = "specTeams";
            } else if (
              players.filter((player) => player.slotStatus === 2 && !player.playerRegion)
                .length === players.length
            ) {
              teamType = "otherTeams";
            } else if (this.testTeam(teamName) === "specTeams") {
              teamType = "specTeams";
            }
          }
          this.teamListLookup[team.team] = {
            type: teamType,
            name: teamName,
          };
        }
        data.payload.players.forEach((newPlayer) => {
          this.slots[newPlayer.slot] = newPlayer;
          if (newPlayer.playerRegion || newPlayer.isSelf) {
            this.#playerData[newPlayer.name] = {
              joinedAt: Date.now(),
            };
          }
        });
      } else {
        throw new Error("Invalid New Lobby Payload Data.");
      }
    } else if (data.fullData) {
      // Check the region
      if (!data.fullData.region || !["us", "eu", "usw"].includes(data.fullData.region)) {
        throw new Error("Invalid region");
      }
      // Ensure slots are there and are valid
      if (!data.fullData.slots || typeof data.fullData.slots !== "object") {
        throw new Error("Invalid Data: Slots Invalid type or missing.");
      }
      if (Object.keys(data.fullData.slots).length > 24) {
        throw new Error("Invalid Data: Slots Over 24");
      }
      // Check the static data
      let dataTest = new Schema(GameClientLobbyPayloadStaticSchema).validate(
        data.fullData.lobbyStatic
      );
      // Finish checking slots
      Object.entries(data.fullData.slots).forEach(([slotNum, slotData]) => {
        if (
          parseInt(slotNum).toString() !== slotNum ||
          parseInt(slotNum) < 0 ||
          parseInt(slotNum) > 23
        ) {
          throw new Error("Invalid Data: Slots Invalid Slot Number: " + slotNum);
        }
        dataTest.concat(PlayerPayloadSchema.validate(slotData));
      });
      // Check chat messages
      dataTest.concat(ChatMessageSchema.validate(data.fullData.chatMessages));
      // Check teamListLookup
      Object.entries(data.fullData.teamListLookup).forEach(([teamNum, teamData]) => {
        if (
          parseInt(teamNum).toString() !== teamNum ||
          parseInt(teamNum) < 0 ||
          parseInt(teamNum) > 24
        ) {
          throw new Error("Invalid Data: Slots Invalid Team Number: " + teamNum);
        }
        dataTest.concat(
          new Schema({
            type: {
              type: String,
              enum: ["otherTeams", "specTeams", "playerTeams"],
              required: true,
            },
            name: { type: String, length: { min: 0, max: 32 }, required: true },
          }).validate(teamData)
        );
      });
      //Check PlayerData
      Object.entries(data.fullData.playerData).forEach(([playerName, playerData]) => {
        if (playerName.length > 32) {
          throw new Error("Invalid Data: Player Name too long: " + playerName);
        }
        dataTest.concat(
          new Schema({
            joinedAt: { type: Number, required: true },
            extra: ExtraDataSchema,
          }).validate(playerData)
        );
      });
      if (dataTest.length > 0) {
        dataTest.forEach((error) => {
          console.error(
            error.path,
            // @ts-ignore
            error.message
          );
        });
        throw new Error(
          "Invalid New Lobby Full Data: " + Object.entries(dataTest[0]).join(", ")
        );
      }
      this.lobbyStatic = data.fullData.lobbyStatic;
      this.region = data.fullData.region;
      this.slots = data.fullData.slots;
      this.teamListLookup = data.fullData.teamListLookup;
      this.chatMessages = data.fullData.chatMessages;
      this.#playerData = data.fullData.playerData;
      this.ingestUpdate({ playerPayload: Object.values(data.fullData.slots) });
    } else {
      throw new Error("Missing New Lobby data.");
    }
    this.lobbyStatic.mapData.mapPath = this.cleanPathName(
      this.lobbyStatic.mapData.mapPath
    );
    let lookup = this.cleanMapName(this.lobbyStatic.mapData.mapName);
    this.lookupName = lookup.mapName;
    this.statsAvailable = lookup.statsAvailable;
    this.allPlayers = this.getAllPlayers(true);
    this.nonSpecPlayers = this.getAllPlayers(false);
  }

  updateLobbySlots(slots: Array<PlayerPayload>): {
    playerUpdates: PlayerPayload[];
    events: {
      isUpdated: boolean;
      events: LobbyUpdates[];
    };
  } {
    let playerUpdates: Array<PlayerPayload> = [];
    let events: {
      isUpdated: boolean;
      events: LobbyUpdates[];
    } = { isUpdated: false, events: [] };
    slots.forEach((player: PlayerPayload) => {
      if (PlayerPayloadSchema.validate(player).length > 0) {
        console.warn("Invalid Player Payload: ", player);
        return;
      }
      if (JSON.stringify(this.slots[player.slot]) !== JSON.stringify(player)) {
        if (
          ((player.playerRegion || player.isSelf) && player.name) ||
          !player.playerRegion
        ) {
          playerUpdates.push(player);
        }
      }
    });
    if (playerUpdates.length > 0) {
      events = this.ingestUpdate({ playerPayload: playerUpdates });
      return { playerUpdates, events };
    } else {
      if (this.log) console.log("No player updates");
      return { playerUpdates, events };
    }
  }

  ingestUpdate(update: LobbyUpdates): {
    isUpdated: boolean;
    events: Array<LobbyUpdates>;
  } {
    let isUpdated = false;
    let events: Array<LobbyUpdates> = [];
    if (update.chatMessage) {
      let dataTest = ChatMessageSchema.validate(update.chatMessage);
      if (dataTest.length > 0) {
        dataTest.forEach((error) => {
          console.error(
            error.path,
            // @ts-ignore
            error.message
          );
        });
      } else {
        isUpdated = this.newChat(update.chatMessage.name, update.chatMessage.message);
      }
    } else if (update.playerPayload) {
      for (const newPayload of update.playerPayload) {
        let dataTest = PlayerPayloadSchema.validate(newPayload);
        if (dataTest.length > 0) {
          dataTest.forEach((error) => {
            console.error(
              error.path,
              // @ts-ignore
              error.message
            );
          });
          break;
        }
        if (this.slots[newPayload.slot] && this.slots[newPayload.slot] !== newPayload) {
          isUpdated = true;
          if (newPayload.playerRegion) {
            if (
              !this.allPlayers.includes(newPayload.name) &&
              !this.#playerData[newPayload.name]
            ) {
              if (this.log) console.log("New Player: " + newPayload.name);
              events.push({ playerJoined: newPayload });
              this.#playerData[newPayload.name] = {
                joinedAt: Date.now(),
              };
            } else if (this.slots[newPayload.slot].playerRegion) {
              if (events.filter((event) => event.playersSwapped).length === 0) {
                if (this.log)
                  console.log(
                    "Players swapped: ",
                    newPayload.name,
                    this.slots[newPayload.slot].name,
                    " Slots: ",
                    newPayload.slot,
                    this.playerToSlot(newPayload.name)
                  );
                events.push({
                  playersSwapped: {
                    slots: [
                      newPayload.slot,
                      this.playerToSlot(newPayload.name) as SlotNumbers,
                    ],
                    players: [newPayload.name, this.slots[newPayload.slot].name],
                  },
                });
              }
            } else {
              console.log("Player Moved: ", {
                from: this.playerToSlot(newPayload.name),
                to: newPayload.slot,
                name: newPayload.name,
              });
              events.push({
                playerMoved: {
                  from: this.playerToSlot(newPayload.name),
                  to: newPayload.slot,
                  name: newPayload.name,
                },
              });
            }
          }
        }
      }
      for (const newPayload of update.playerPayload) {
        this.slots[newPayload.slot] = newPayload;
      }
      // TODO: The leave function need to be checked.
      for (const player of this.allPlayers) {
        if (!this.getAllPlayers(true).includes(player)) {
          isUpdated = true;
          if (this.log) console.log("Player left: " + player);
          events.push({ playerLeft: player });
          delete this.#playerData[player];
        }
      }
      this.allPlayers = this.getAllPlayers(true);
      this.nonSpecPlayers = this.getAllPlayers(false);
    } else if (update.playerData) {
      if (update.playerData.extraData) {
        let dataTest = ExtraDataSchema.validate(update.playerData.extraData);
        if (dataTest.length > 0) {
          dataTest.forEach((error) => {
            console.error(
              error.path,
              // @ts-ignore
              error.message
            );
          });
        } else {
          if (this.#playerData[update.playerData.name]) {
            isUpdated =
              JSON.stringify(this.#playerData[update.playerData.name].extra) !==
              JSON.stringify(update.playerData.extraData);
            this.#playerData[update.playerData.name].extra = update.playerData.extraData;
          } else if (this.getAllPlayers(true).includes(update.playerData.name)) {
            if (this.log)
              console.warn(
                "Player Data Update for non-existent player, but they are in lobby: " +
                  update.playerData.name
              );
            isUpdated = true;
            this.#playerData[update.playerData.name] = {
              joinedAt: Date.now(),
              extra: update.playerData.extraData,
            };
          }
        }
      }
    }
    return { isUpdated, events };
  }

  getAllPlayerData(): {
    [key: string]: PlayerData;
  } {
    return this.#playerData;
  }

  getAllPlayers(includeNonPlayerTeams: boolean = false): Array<string> {
    let target = includeNonPlayerTeams
      ? Object.values(this.slots).filter((slot) => slot.playerRegion || slot.isSelf)
      : Object.values(this.slots).filter(
          (slot) =>
            this.teamListLookup[slot.team].type === "playerTeams" &&
            (slot.playerRegion || slot.isSelf)
        );
    return target.map((slot) => slot.name);
  }

  newChat(name: string, message: string): boolean {
    let currentTime = new Date().getTime();
    // If the same message is sent within 1 second, skip.
    if (
      Object.values(this.chatMessages).filter(
        (chat) => chat.message === message && Math.abs(chat.time - currentTime) < 1000
      ).length === 0
    ) {
      this.chatMessages.push({ name, message, time: currentTime });
      return true;
    }
    return false;
  }

  exportTeamStructure(playerTeamsOnly: boolean = true): PlayerTeamsData {
    let returnValue: PlayerTeamsData = {};
    let targetTeams = Object.entries(this.teamListLookup)
      .filter((team) => (playerTeamsOnly ? team[1].type === "playerTeams" : true))
      .map((team) => [team[0], team[1].name]);
    targetTeams.forEach(([teamNum, teamName]) => {
      let teamNumber = parseInt(teamNum);
      returnValue[teamName] = Object.values(this.slots)
        .filter((player) => teamNumber === player.team)
        .map((player) => {
          let name =
            player.slotStatus === 2
              ? player.name
              : player.slotStatus === 1
              ? "CLOSED"
              : "OPEN";
          return {
            name: name,
            realPlayer: player.playerRegion !== "",
            slotStatus: player.slotStatus,
            slot: this.playerToSlot(player.name),
            data:
              this.#playerData[player.name] ??
              (player.playerRegion !== ""
                ? {
                    joinedAt: Date.now(),
                  }
                : -1),
          };
        });
    });
    return returnValue;
  }

  exportMin(): MicroLobbyData {
    return {
      lobbyStatic: this.lobbyStatic,
      region: this.region,
      slots: this.slots,
      teamListLookup: this.teamListLookup,
      chatMessages: this.chatMessages,
      playerData: this.#playerData,
    };
  }

  getSelf(): string {
    return Object.values(this.slots).find((slot) => slot.isSelf)?.name ?? "";
  }

  cleanPathName(path: string): string {
    if (path.includes("/")) {
      return path.substring(path.lastIndexOf("/") + 1);
    } else {
      return path;
    }
  }

  cleanMapName(mapName: string): { statsAvailable: boolean; mapName: string } {
    let newStats = true;
    let returnName = "";
    if (mapName.match(/(HLW)/i)) {
      returnName = "HLW";
    } else if (mapName.match(/(pyro\s*td\s*league)/i)) {
      returnName = "Pyro TD";
    } else if (mapName.match(/(vampirism\s*fire)/i)) {
      returnName = "Vampirism Fire";
    } else if (mapName.match(/(footmen.*vs.*grunts)/i)) {
      returnName = "Footmen Vs Grunts";
    } else if (mapName.match(/Broken.*Alliances/i)) {
      returnName = "Broken Alliances";
    } else if (mapName.match(/Reforged.*Footmen/i)) {
      returnName = "Reforged Footmen Frenzy";
    } else if (mapName.match(/Direct.*Strike.*Reforged/i)) {
      returnName = "Direct Strike";
    } else if (mapName.match(/WW3.*Diplomacy/i)) {
      returnName = "WW3 Diplomacy";
    } else if (mapName.match(/Legion.*TD/i)) {
      returnName = "Legion TD";
    } else if (mapName.match(/Tree.*Tag/i)) {
      returnName = "Tree Tag";
    } else if (mapName.match(/Battleships.*Crossfire/i)) {
      returnName = "Battleships Crossfire";
    } else {
      newStats = false;
      returnName = mapName.trim().replace(/\s*v?\.?(\d+\.)?(\*|\d+)\w*\s*$/gi, "");
    }
    this.statsAvailable = newStats;
    return { statsAvailable: newStats, mapName: returnName };
  }

  playerToSlot(player: string): SlotNumbers | -1 {
    let slot = Object.values(this.slots).find((slot) => slot.name === player);
    if (slot) {
      return slot.slot;
    } else {
      console.log(this.slots);
      console.warn("Player not found in slot list: " + player);
      return -1;
    }
  }

  searchPlayer(name: string): string[] {
    return this.allPlayers.filter((user) => user.match(new RegExp(name, "i")));
  }

  testTeam(teamName: string): "otherTeams" | "playerTeams" | "specTeams" {
    if (teamName.match(/((computer)|(creeps)|(summoned))/i)) {
      return "otherTeams";
    } else if (teamName.match(/((host)|(spectator)|(observer)|(referee))/i)) {
      return "specTeams";
    }
    return "playerTeams";
  }
}

type ValidObjectTypes = "boolean" | "object" | "string" | "number";

interface ObjectLookup {
  [key: string]: ValidObjectTypes | ObjectLookup | Array<any>;
}

export type Regions = "us" | "eu";

export type TeamTypes = "otherTeams" | "specTeams" | "playerTeams";

export type SlotNumbers =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23;

export interface ChatMessage {
  name: string;
  message: string;
  time: number;
}

export interface PlayerData {
  joinedAt: number;
  extra?: {
    played: number;
    wins: number;
    losses: number;
    rating: number;
    lastChange: number;
    rank: number;
    [key: string]: any;
  };
}

export interface PlayerTeamsData {
  [key: string]: Array<{
    name: string;
    slotStatus: 0 | 1 | 2;
    slot: number;
    realPlayer: boolean;
    data: PlayerData;
  }>;
}

export interface PlayerPayload {
  // 0 = open, 1 = closed, 2 = filled
  slotStatus: 0 | 1 | 2;
  slot: SlotNumbers;
  team: number;
  //What are slot types?
  // 0 = useable, 1 = managed?
  slotType: number | 0 | 1;
  isObserver: boolean;
  isSelf: boolean;
  slotTypeChangeEnabled: boolean;
  // always 255?
  id: number;
  name: string | "Computer (Easy)" | "Computer (Normal)" | "Computer (Insane)";
  //Regions tbd, usw might replace us
  playerRegion: Regions | "usw" | "";
  //what are gateways?
  playerGateway: number | -1;
  color: SlotNumbers;
  colorChangeEnabled: boolean;
  teamChangeEnabled: boolean;
  race: 0 | 1 | 2 | 3 | 4;
  raceChangeEnabled: boolean;
  handicap: number;
  handicapChangeEnabled: boolean;
}

export interface GameClientLobbyPayloadStatic {
  isHost: boolean;
  playerHost: string;
  maxTeams: number;
  isCustomForces: boolean;
  isCustomPlayers: boolean;
  mapData: {
    mapSize: string | "Extra Small";
    mapSpeed: string | "Fast";
    mapName: string;
    mapPath: string;
    mapAuthor: string;
    description: string;
    suggested_players: string;
  };
  lobbyName: string;
  mapFlags: {
    flagLockTeams: boolean;
    flagPlaceTeamsTogether: boolean;
    flagFullSharedUnitControl: boolean;
    flagRandomRaces: boolean;
    flagRandomHero: boolean;
    settingObservers:
      | "No Observers"
      | "Observers on Defeat"
      | "Referees"
      | "Full Observers";
    typeObservers: 0 | 1 | 2 | 3;
    settingVisibility: "Default" | "Hide Terrain" | "Map Explored" | "Always Visible";
    typeVisibility: 0 | 1 | 2 | 3;
  };
}

export interface GameClientLobbyPayload extends GameClientLobbyPayloadStatic {
  teamData: {
    teams: Array<{ name: string; team: number; filledSlots: number; totalSlots: number }>;
    playableSlots: number;
    filledPlayableSlots: number;
    observerSlotsRemaining: number;
  };
  availableTeamColors: {
    [key: string]: Array<number>;
  };
  players: Array<PlayerPayload>;
}

export interface MicroLobbyData {
  lobbyStatic: GameClientLobbyPayloadStatic;
  region: Regions;
  slots: { [key: string]: PlayerPayload };
  teamListLookup: {
    [key: string]: { type: TeamTypes; name: string };
  };
  chatMessages: Array<ChatMessage>;
  playerData: {
    [key: string]: PlayerData;
  };
}

export interface LobbyUpdates {
  lobbyReady?: true;
  leftLobby?: true;
  newLobby?: MicroLobbyData;
  slotOpened?: number;
  slotClosed?: number;
  stale?: true;
  playerMoved?: {
    from: number;
    to: number;
    name: string;
  };
  playersSwapped?: { players: [string, string]; slots: [SlotNumbers, SlotNumbers] };
  playerLeft?: string;
  playerJoined?: PlayerPayload;
  playerPayload?: Array<PlayerPayload>;
  playerData?: { name: string; data?: PlayerData; extraData?: PlayerData["extra"] };
  chatMessage?: { name: string; message: string };
}
