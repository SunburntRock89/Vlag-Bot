const Command = require("./Command.js");

module.exports = class Vlag extends Command {
	async run({ msg, suffix }) {
		msg.channel.send(`All hail our mighty leader, <@139836912335716352>!`);
	}
};

