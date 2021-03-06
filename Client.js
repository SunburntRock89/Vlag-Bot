global.commands = require("./Configs/commands.js");
global.config = require("./Configs/config.js");
const reload = require("require-reload")(require);
const S = require("string");

let commandModule = {};

const { Client, Collection, Util } = require("discord.js");

module.exports = class VBotClient extends Client {
	constructor(options) {
		super(options);
		/**
		 * Usage collection, mapped by command name
		 */
		this.commandUsage = new Collection();

		/**
		 * Suspicious activity collection >.>
		 * @type {Collection<Snowflake, Object>}
		 */
		this.activity = new Collection();

		/**
		 * Starboard collection
		 * @type {Collection<Snowflake, GuildStarboard>}
		 */
		this.starboards = new Collection();
	}

	/**
	 * See if the snapshot handler is available
	 */
	get SnapshotHandler() {
		try {
			return require("./Handlers/SnapshotHandler");
		} catch (err) {
			return null;
		}
	}

	reloadConfigs() {
		global.config = reload("./Configs/config.js");
		global.commands = reload("./Configs/commands.js");
		this.reloadAllCommands(true);
	}

	reloadCommand(command) {
		try {
			commandModule[command] = reload(`./Commands/${command}.js`);
			return Promise.resolve();
		} catch (err) {
			return Promise.reject(err);
		}
	}

	reloadAllCommands(force = false) {
		let commandKeys = Object.keys(commandModule);
		if (!commandKeys.length) commandKeys = Object.keys(commands);
		if (force) commandKeys = Object.keys(commands);
		for (const command of commandKeys) {
			if (command.startsWith("_") || command === "Command") continue;
			this.reloadCommand(command).catch(err => {
				console.error(`Failed to reload command ${command}:\n${err.stack}`);
			});
		}
	}

	getCommand(command) {
		if (commandModule[command]) {
			return commandModule[command];
		}	else {
			for (let [key, value] of Object.entries(commands)) {
				if (value.aliases && value.aliases.length > 0) {
					if (value.aliases.includes(command.toLowerCase().trim())) return commandModule[key];
				}
			}
		}
	}

	getCommandInfo(command) {
		if (commands[command]) {
			return commands[command];
		}	else {
			for (let [key, value] of Object.entries(commands)) {
				if (value.aliases && value.aliases.length > 0) {
					if (value.aliases.includes(command.toLowerCase().trim())) return commands[key];
				}
			}
		}
		return null;
	}

	getCommandName(command) {
		command = command.toLowerCase().trim();
		for (const [k, v] of Object.entries(commands)) {
			if (k === command) {
				return k;
			}	else if (v.aliases && v.aliases.length > 0) {
				if (v.aliases.includes(command)) return k;
			}
		}
		return null;
	}

	checkCommandTag(message) {
		message = message.trim();
		let object = {
			command: null,
			suffix: null,
		};
		let cmdStr;
		if (config.allowMentionAsPrefix && (message.startsWith(this.user.toString()) || message.startsWith(`<@!${this.user.id}>`))) {
			if (message.startsWith(this.user.toString())) cmdStr = message.substring(this.user.toString().length + 1);
			else if (message.startsWith(`<@!${this.user.id}>`)) cmdStr = message.substring(`<@!${this.user.id}>`.length + 1);
		} else if (message.startsWith(config.prefix)) {
			cmdStr = message.substring(config.prefix.length);
		}
		if (cmdStr && !cmdStr.includes(" ")) {
			object = {
				command: cmdStr.toLowerCase(),
				suffix: null,
			};
		} else if (cmdStr) {
			let command = cmdStr.split(" ")[0].toLowerCase();
			let suffix = cmdStr.split(" ")
				.splice(1)
				.join(" ")
				.trim();
			object = {
				command: command,
				suffix: suffix,
			};
		}
		return object;
	}

	isMaintainer(user) {
		return config.maintainers.indexOf(user.id || user) > -1;
	}

	logEvent({ event, args = [], joinParam = " ", shortMessage = "" }) {
		console.log(`[${event.toUpperCase()}] ${shortMessage}${args.length > 0 ? ` :: ${args.join(joinParam)}` : ""}`);
	}

	logCommand({ command, ran = true, reason = null, user = null, userID = null, guild = null, guildID = null, channel = null, channelID = null, suffix = null }) {
		let string = `
[${command.toUpperCase()}]
» Ran  	: ${ran}
» User 	: ${user}
» Where	: ${guild && channel && channelID ? `${guild}, #${channel} (${channelID})` : `DMs (${channelID})`}
» Suffix: ${suffix ? `"${suffix}"` : "No suffix provided"}
${!ran && reason ? `» Reason: ${S(reason).capitalize().s}\n` : ""}`;
		console.log(string);
		if (guild && config.logging && config.logging.guild && config.logging.channel) {
			let fields = [
				{
					name: `Basic Info`,
					value: `» Ran: **${ran}**\n» User: **${user}** (${userID})\n» Channel: **${channel ? `#${channel}` : "DMs"}** (${channelID})`,
					inline: true,
				},
			];
			if (reason) {
				fields.push({
					name: `​`,
					value: `The command wasn't ran because ${reason}`,
					inline: false,
				});
			}
			fields.push(
				{
					name: `${suffix ? `The following suffix was provided:` : "There was no suffix provided."}`,
					value: `${suffix ? `\`\`\`css\n${suffix.replace(/```/g, "")}\`\`\`` : "​"}`,
					inline: false,
				},
			);
			this.guilds.get(config.logging.guild).channels.get(config.logging.channel).send({
				embed: {
					color: 0xADD8E6,
					author: {
						name: `${guild ? `${guild} (${guildID})` : `DMs (${channelID}`}`,
						iconURL: guild && guildID ? this.guilds.get(guildID).iconURL({ size: 128 }) : "",
					},
					thumbnail: {
						url: userID ? this.users.get(userID).displayAvatarURL({ size: 128 }) : "",
					},
					title: `Command "${command}" was triggered`,
					fields,
				},
			});
		}
	}

	startPlayingStatus() {
		if (config.playingStatuses.length > 1) {
			changePlayingStatus(this);
		} else {
			this.user.setActivity(config.playingStatuses[0]);
		}
	}
};

function changePlayingStatus(client) {
	let randomQuote = config.playingStatuses[Math.floor(Math.random() * config.playingStatuses.length)];
	client.logEvent({ event: "PRESENCE", shortMessage: `Changed my playing status to "${randomQuote}"` });
	client.user.setActivity(randomQuote);
	return client.setTimeout(changePlayingStatus, config.changePlayingStatusEvery, client);
}
