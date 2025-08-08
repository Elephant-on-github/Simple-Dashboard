import { log } from "console";
log("running")
let spam = false
while(true){
    const now = new Date();
    if ((now.getMinutes() % 2 === 0) && (now.getSeconds() === 0)) {
        if (!spam) {
            // This block runs every 2 minutes at the start of the minute
            log(`Current time: ${now.toLocaleTimeString()}`);
            spam = true;
        }
    } else {
        spam = false;
    }
}