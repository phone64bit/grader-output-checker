const config = require("./config.json");
const fs = require("fs");
const cp = require("child_process");
const find = require("find-process");

var file = fs.readFileSync(`./a.${config.filetype}`);

if(!file) throw new Error(`Can't find a.${config.filetype}`);

var wait = async (ms) => {
    return new Promise(async (resolve, __) => {
        setTimeout(resolve, ms);
    });
}

var __compile = async (command) => {
    await find("name", "a", true).then(list => { list.forEach(async (d) => { await process.kill(d.pid); }); });
    return await new Promise(async(resolve, reject) => {
        const child = await cp.spawn(command, {shell: true});
        child.stderr.on("data", (data) => {
            reject(new Error(`COMPILATION ERROR\n${data}`));
        });
        child.on("exit", () => resolve(1));
    });
}

var __checker = async (input_filename, output_filename) => {
    return await new Promise(async(resolve, reject) => {
        const child = await cp.spawn(`a.exe < ${input_filename} > ${output_filename}`, {shell:true, timeout: parseInt(config.settings.time), killSignal: "SIGKILL"});
        child.on("exit", async (exitCode, signal) => {
            if(exitCode != 0) await find("name", "a", true).then(list => { list.forEach(async (d) => { await process.kill(d.pid); }); });
            resolve(child.signalCode == "SIGKILL" ? "time" : child.exitCode != 0 ? "overflow" : 1);
        });
    });
}


(async() => {

    // Compile file with specify language.
    var cmd = config.languages.find(d => d.name === config.filetype);
    if(!cmd) throw new Error(`Invalid filetype [${config.filetype}]`);
    
    const compile_result = await __compile(cmd.exec);

    if(compile_result != 1) throw new Error(`COMPILATION ERROR`);

    var pass = 0, count = 0;
    var G_score = "";

    for(const file of fs.readdirSync(config.input_directory).filter(f => f.endsWith(`.${config.input_filetype}`))) {
        console.log(file);
        var result = await __checker(`${config.input_directory}/${file}`, `${config.checker_directory}/a.out`);
        if(result=="time" || result=="overflow") {
            ++count;
            G_score += result == "time" ? "T" : "x";
            continue;
        }
        var output_user = await fs.readFileSync(`${config.checker_directory}/a.out`);
        var output_checker = await fs.readFileSync(`${config.output_directory}/${file.slice(0, file.length-config.input_filetype.length)}${config.output_filetype}`);
        if(!output_checker) throw new Error(`INVALID OUTPUT FILE [${config.output_directory}/${file.slice(0, file.length-config.input_filetype.length)}${config.output_filetype}]`);
        var isPass = await output_checker.equals(output_user);
        pass += isPass;
        G_score += (isPass) ? 'P' : '-';
        ++count;
    }
    console.log(`[${G_score}]`);
    console.log(`${pass}/${count} PASSED ${count-pass} WRONG.`);
    console.log(`PERCENTAGE: ${parseFloat(pass*100/count).toFixed(2)}`);
    process.exit(0);
})();