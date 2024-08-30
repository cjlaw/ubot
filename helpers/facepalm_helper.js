export class FacepalmHelper {
  static handleFacepalmMention(message) {
    if (
      message.content.match(/Trump/i) &&
      !message.content.includes(":man_facepalming:")
    ) {
      message.react("🤦‍♂️");
      return `**burywite** said :man_facepalming: to something about Trump`;
    }
  }
}
