require("dotenv").config();
const { getClient } = require("./src/search/telegramIndexer");

async function test() {
  const tg = await getClient();
  const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
  try {
    const fwd = await tg.forwardMessages(relayGroupId, {
      messages: [2071, 2072],
      fromPeer: "@AplusEthiopian"
    });
    console.log("fwd length:", fwd.length);
    console.log("fwd[0] length:", fwd[0]?.length);
    if (Array.isArray(fwd[0])) {
       console.log("fwd[0][0].id:", fwd[0][0]?.id);
       console.log("fwd[0][1].id:", fwd[0][1]?.id);
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
test();
