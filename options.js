document.addEventListener('DOMContentLoaded', () => {
	const all_vaccines = ['COVAXIN', 'COVISHIELD', 'SPUTNIK V'];
	const all_doses = ['dose1', 'dose2'];
	const all_age_lims = ['18','45'];	

	var audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
	audio.loop=true;
	
	let scriptId = 0;

	document.querySelector('#runnerButton').addEventListener('click', onSubmit);
	document.querySelector('#stopScriptButton').addEventListener('click', stopScript);

	function stopScript() {
		audio.pause();
	  	audio.currentTime = 0;
		clearInterval(scriptId);
		if (scriptId) {
			append_to_dom('red', '- Script Terminated by User -');
		}
		scriptId = 0;
		left_notifs = document.getElementById("left-notifs");
		left_notifs.scrollTop = left_notifs.scrollHeight;
	}

	function onSubmit () {
		// stop any script which was already running
		stopScript();

		if (!allParamsPresent()) {
			append_to_dom('red', "Something went wrong. Fill all entries carefully.");
			return;
		}

		const today = new Date();
		var dates = [];
		some_y = today.getFullYear();
		some_m = today.getMonth() + 1;
		some_d = today.getDate();
		dates.push(some_d + "-" + some_m + "-" + some_y);

		const run_every_x_secs = (parseInt(document.getElementById("every_x_secs").value));
		var pincodes = document.getElementById("pincode").value.replace(/ /g,'').split(',');
		//remove those strings which aren't pincodes..e.g. some empty string remaining afeter splitting by comma
		pincodes = pincodes.filter(pc => is_a_pin_code(pc));
		//remove duplicate pincodes
		pincodes = [...new Set(pincodes)];

		if((pincodes.length*5*60) > 85*run_every_x_secs) {
			append_to_dom('red', "Can not proceed. Total requests per 5 min. exceeds the prescribed limit! Either Increase poll-interval or remove some pincodes.");
			return;
		}

		const vaccine_input = all_vaccines.filter((vacc) => {
			return document.getElementById(vacc).checked;
		});

		const dose_input = all_doses.filter((dose) => {
			return document.getElementById(dose).checked;
		});

		const age_lim_input = all_age_lims.filter((age_lim) => {
			return document.getElementById(age_lim).checked;
		});

		document.getElementById("left-notifs").appendChild(document.createElement("hr"));
		append_to_dom('blue', `[${get_params_string(age_lim_input,pincodes,vaccine_input,dose_input)}] Running Script..`);

		check_availability(dates,age_lim_input,run_every_x_secs,pincodes, vaccine_input, dose_input);
		scriptId = setInterval(function(){
			check_availability(dates,age_lim_input,run_every_x_secs,pincodes, vaccine_input, dose_input);
		}, run_every_x_secs * 1000);
	}

	function check_availability(dates,age_lim_input,run_every_x_secs,pincodes, vaccine_input, dose_input) {
		// pause any existing alarms before every query.. so that if nothing is found in latest query, alarm stops
		audio.pause();
	  	audio.currentTime = 0;

		var internet_connection_working = window.navigator.onLine;
		if (!internet_connection_working) {
			append_to_dom('red', `[${new Date().toLocaleString()}] YOUR INTERNET CONNECTION IS OFFLINE. Unable to query CoWIN APIs.`);
			append_to_dom('black', `[Waiting for ${document.getElementById("every_x_secs").value} seconds before trying again. Please connect to a stable network.]`);
			return;
		}

		var new_tbody = delete_old_rows();
		append_to_dom('blue', `[${new Date().toLocaleString()}] Querying CoWIN APIs..`);
		var tbl_rows = 0;
		dates.forEach((xdate) => {
			pincodes.forEach((pincode) => {
				let url = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=' + pincode + '&date=' + xdate;;
				fetch(url)
				.then(res => res.json())
				.then((out) => {
				  out.centers.forEach((center) => {
				    center.sessions.forEach((sess) => {
				        if(sess.min_age_limit &&
				        	vaccine_input.includes(sess.vaccine) &&
				        	age_lim_input.includes(sess.min_age_limit.toString()) &&
				          	((dose_input.includes('dose1') && sess.available_capacity_dose1>0) || (dose_input.includes('dose2') && sess.available_capacity_dose2>0)) ) 
				        {
				        	let msg = "";
				        	if(dose_input.includes('dose1') && sess.available_capacity_dose1>0) {
					            msg = `ALERT(${new Date().toLocaleString()}): ${sess.available_capacity_dose1} qty. of ${sess.vaccine}(Dose #1) are available at ${center.name}(${center.district_name}) on ${sess.date} (${sess.min_age_limit}+)`;
				        		tbl_rows+=1;
								addRowsToTable(new_tbody,[tbl_rows, `${sess.min_age_limit}+`, pincode, center.name, center.district_name, sess.date, sess.vaccine, `Dose1: ${sess.available_capacity_dose1}`]);
				        	}	
		                    console.log(msg);
							append_to_dom('green', msg);

							if(dose_input.includes('dose2') && sess.available_capacity_dose2>0) {
					            msg = `ALERT(${new Date().toLocaleString()}): ${sess.available_capacity_dose2} qty. of ${sess.vaccine}(Dose #2) are available at ${center.name}(${center.district_name}) on ${sess.date} (${sess.min_age_limit}+)`;
				        		tbl_rows+=1;
								addRowsToTable(new_tbody,[tbl_rows, `${sess.min_age_limit}+`, pincode, center.name, center.district_name, sess.date, sess.vaccine, `Dose2: ${sess.available_capacity_dose2}`]);
				        	}	
		                    console.log(msg);
							append_to_dom('green', msg);
							play();
				        }
				    });
				  });
				})
				.catch(err => { throw err });
	    		console.log('----------', new Date().toLocaleString(), '----------\n');
			});
		});
		update_last_upd_time();
		append_to_dom('black', `[Waiting for ${document.getElementById("every_x_secs").value} seconds before querying again]`);
	}

	function get_params_string(age_lim_input,pincodes,vaccine_input,dose_input) {
		let str = "";
		for (let age of age_lim_input) {
			str += (age+"+_");
		}
		for (let pc of pincodes) {
			str += (pc+"_");
		}
		for (let vacc of vaccine_input) {
			str += (vacc+"_");
		}
		for (let dose of dose_input) {
			str += (dose+"_");
		}
		str = str.slice(0,-1);
		return str;
	}

	function append_to_dom(color, msg) {
		const div = document.createElement('div');
		div.textContent = msg;
		div.style.color = color;
		left_notifs = document.getElementById("left-notifs");
		left_notifs.appendChild(div);
		left_notifs.scrollTop = left_notifs.scrollHeight;
	}

	function play() {
	  // audio.pause();
	  audio.currentTime = 0;
	  audio.play();
	}

	function delete_old_rows() {
		var old_tbody = document.getElementById("latest_table_body");
		var new_tbody = document.createElement('tbody');
		new_tbody.setAttribute("id", "latest_table_body");
		old_tbody.parentNode.replaceChild(new_tbody, old_tbody);
		return new_tbody;
	}

	function addRowsToTable(new_tbody, data) {
		var row = new_tbody.insertRow(-1);
		var i=0;
		for (cell_data of data) {
			var cell = row.insertCell(i);
			cell.innerHTML = cell_data;
			i+=1;
		}
		update_last_upd_time();
	}

	function update_last_upd_time() {
		document.getElementById("last_updated_time").innerHTML = `[Last Updated Time: ${new Date().toLocaleString()}]`;
	}

	// Date.prototype.addDays = function(days) {
	//     var date = new Date(this.valueOf());
	//     date.setDate(date.getDate() + days);
	//     return date;
	// }

	function allParamsPresent() {
		return ( (document.getElementById("18").checked || document.getElementById("45").checked )
			&& (document.getElementById("COVAXIN").checked || document.getElementById("COVISHIELD").checked || document.getElementById("SPUTNIK V").checked )
			&& (document.getElementById("dose1").checked || document.getElementById("dose2").checked )
			&& (check_pincodes_format())
			&& (document.getElementById("every_x_secs").value)
			&& (parseInt(document.getElementById("every_x_secs").value) >= 15)
		);
	}

	function check_pincodes_format() {
		
		var pcs = document.getElementById("pincode").value.replace(/ /g,'').split(',');
		var are_all_pcs_valid = true;
		for(let pc of pcs){
			are_all_pcs_valid &= is_a_pin_code(pc);
		}
		// console.log(are_all_pcs_valid, 'isvalid');
		return are_all_pcs_valid;
	}

	function is_a_pin_code(pc) {
		// should we use a more correct regex? dont think so.
		const pc_regex = new RegExp("[0-9]{6}");
		return pc_regex.test(pc);
	}

});