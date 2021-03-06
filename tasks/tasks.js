'use strict';

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const sudo = require('sudo-prompt');
const ora = require('ora');

const Prompt = require('prompt-checkbox');

const spinerDefaults = {
	spinner: 'dots8'
};

const spinners = {
	globalPackages: () => ora({
		...spinerDefaults,
		text: 'Loading global dependencies'
	}),
	proccessingPackages: () => ora({
		...spinerDefaults,
		text: 'Processing dependencies list'
	}),
	removingPackages: () => ora({
		...spinerDefaults,
		text: 'Removing global packages'
	})
};

const ignoreDefaultPackages = array => {
	const itemsToRemove = ['npm', 'yarn', 'npm-global-rm-interactive'];
	return array.filter(item => !itemsToRemove.includes(item));
};

const npmGlobalPackages = async () => {
	const spinnerPckgs = spinners.globalPackages();
	spinnerPckgs.start();

	try {
		const {stdout} = await exec('npm list -g --depth 0 -json');
		const globalDependencies = await Object.keys(JSON.parse(stdout).dependencies);
		const noDefaultInstalledPackages = await ignoreDefaultPackages(globalDependencies);
		spinnerPckgs.succeed('Global dependencies listed');
		return noDefaultInstalledPackages;
	} catch (error) {
		spinnerPckgs.fail('Error with the list proccess');
		throw (error);
	}
};

const ask = async listToAsk => {
	if (listToAsk.length === 0) {
		return [];
	}
	const promptList = new Prompt({
		name: 'install',
		message: 'Which packages do you want to remove?',
		radio: true,
		choices: listToAsk
	});
	const answers = await promptList.run()
		.then(answers => answers)
		.catch(error => {
			throw (error);
		});
	return answers;
};

const promptOptions = {
	name: 'Node'
};

const removeBatch = async list => {
	const concatenatedList = await list.join(' ');
	const spinnerRemover = spinners.removingPackages();
	spinnerRemover.start();

	try {
		const stdout = sudo.exec('npm uninstall -g ' + concatenatedList, promptOptions, (error, stdout) => {
			if (error) {
				spinnerRemover.fail('Error with the uninstall proccess');
				throw (error);
			}
			spinnerRemover.succeed('Package(s) succesfully removed: ' + concatenatedList);
			return stdout;
		});
		return stdout;
	} catch (error) {
		throw (error);
	}
};

const getPackagesToRemove = async () => {
	const listToAsk = await npmGlobalPackages();
	return ask(listToAsk);
};

const isFilledList = answers => Boolean(answers.length);

const processList = async answers => {
	const spinnerProcessing = spinners.proccessingPackages();
	spinnerProcessing.start();

	if (isFilledList(answers)) {
		spinnerProcessing.succeed('Packages proceding to remove.');
		await removeBatch(answers);
	} else {
		spinnerProcessing.succeed('Empty list. No packages uninstalled.');
	}
};

module.exports = {
	getPackagesToRemove,
	removeBatch,
	processList,
	ignoreDefaultPackages
};
