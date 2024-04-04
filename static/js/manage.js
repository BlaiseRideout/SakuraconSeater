(function($) {
	$(function() {
		///////////////////
		//    GLOBALS    //
		///////////////////

		var debug = true;
		var tableTemplate;
		var queueTemplate;
		var signupTemplate;
		var tableTypes;
		var editMode = false;


		///////////////////
		//   RETRIEVAL   //
		///////////////////

		function getTables() {
			getTableTypes(function () {
				$.getJSON('/api/tables', function(data) {
					if(!tableTemplate) {
						window.setTimeout(getTables, 500);
						return;
					}
					data["tabletypes"] = jQuery.extend(true, [], window.tableTypes);
					$("#tables").html(Mustache.render(tableTemplate, data));
					$(".table").each(function (i, table) {
						var x = $(table).data("x");
						var y = $(table).data("y");
						if(x !== undefined)
							$(table).css({'left':x})
						if(y !== undefined)
							$(table).css({'top':y})
						var tabletypeinput = $(this).find("select.tabletype");
						var tabletypedisp = $(this).find("span.tabletypedisp");

						tabletypeinput.val(tabletypeinput.data("type"));

						if(editMode) {
							tabletypeinput.show();
							tabletypedisp.hide();
						}
						else {
							tabletypeinput.hide();
							tabletypedisp.show();
						}
					});
					if(editMode) {
						$("#tables .tabletype").change(window.tableType);
						$("#tables .table").draggable({
							snap:true,
							snapMode:"both",
							stop:function(event, ui) {
								$.post("/api/tableposition",
											 {'x':ui.position.left,
												 'y':ui.position.top,
												 'table':ui.helper.data("id")},
											 function(data) {
												 notify(data.message, data.status);
								}, 'json');
							}
						});
						$("#tables .table").find(".elapsed,.players,.startbutton,.fillbutton,.notifybutton").hide();
						$("#addtable").css("display", "inline-block");
						$("#editmode").text("Stop Editing");
					}
					else {
						$("#tables .tabletype").attr("disabled", true);
						$("#tables .topbar > .delete").hide();
					}
					$(".players").sortable({
						connectWith:".playerqueue, .players",
						update:function(event, ui) {
							// if we're moving a queue player back to a table
							if(this === ui.item.parent()[0] && ui.sender !== null) {
								$.post("/api/tableplayer",
											 {'player':ui.item.data("id"),
												 'table':ui.item.parents(".table").data("id")},
											 function(data) {
												 notify(data.message, data.status);
												 if(data.status === "error") {
													 $(this).sortable("cancel");
													 ui.sender.sortable("cancel");
													 return;
												 }
												 refresh();
								}.bind(this), 'json');
							}
							else
								refresh();
						}
					}).disableSelection();
				}).fail(window.xhrError);
			});
		}
		function getQueue() {
			getTableTypes(function() {
				$.getJSON('/api/queue', function(data) {
					if(!queueTemplate) {
						window.setTimeout(getQueue, 500);
						return;
					}
					data.LoggedIn = true;
					$("#queue").html(Mustache.render(queueTemplate, data));
					updateTimes();
					$(".playerqueue").sortable({
						connectWith:".players,.playerqueue",
						update:function(event, ui) {
							// if we're moving a table player back to the queue
							if(this === ui.item.parent()[0] && ui.sender !== null) {
								$.post("/api/queueplayer",
											 {'player':ui.item.data("id"), type:$(this).data("type")},
											 function(data) {
												 notify(data.message, data.status);
												 refresh();

												 if(data.status === "error") {
													 $(this).sortable("cancel");
													 ui.sender.sortable("cancel");
												 }
								}.bind(this), 'json');
							}
							else
								refresh();
						}
					}).disableSelection();
				}).fail(window.xhrError);
			});
		}
		function getSignup() {
			if(!signupTemplate) {
				window.setTimeout(getSignup, 500);
				return;
			}
			getTableTypes(function(tableTypes) {
				var data = {'tabletypes': tableTypes};
				$("#signupform").html(Mustache.render(signupTemplate, data));
			});
		}

		///////////////////
		//     SETUP     //
		///////////////////

		$.get("/static/mustache/table.mst", function(data) {
			tableTemplate = data;
			Mustache.parse(data);
		});
		$.get("/static/mustache/queue.mst", function(data) {
			queueTemplate = data;
			Mustache.parse(data);
		});
		$.get("/static/mustache/signup.mst", function(data) {
			signupTemplate = data;
			Mustache.parse(data);
		});
		window.refresh = function() {
			getSignup();
			getTables();
			getQueue();
		}
		refresh();
		function updateTimes() {
			var now = new Date();
			$(".table.playing").each(function(i, table) {
				var started = $(table).data("started-date");
				if(started === undefined) {
					$(table).data("started-date", new Date($(table).data("started")));
					started = $(table).data("started-date");
				}
				var elapsed = Math.floor(now - started);
				$(table).children(".elapsed").text(timeString(elapsed));
				if(elapsed > $(table).data('duration') * 60 * 1000)
					$(table).addClass("warn");
			});
			$(".queueeta").each(function(i, player) {
				var eta = $(player).data("eta-date");
				if(eta === undefined) {
					var eta = new Date($(player).data("eta"));
					if(!isNaN(eta.getTime())) {
						$(player).data("eta-date", eta);
						eta = $(player).data("eta-date");
					}
					else
						eta = undefined;
				}
				if(eta !== undefined) {
					var remaining = Math.floor(eta - now);
					if(remaining > 0)
						$(player).children(".remaining").text(timeString(remaining));
					else
						$(player).children(".remaining").text("NOW");
				}
			});
			$(".player.queued").each(function(i, player) {
				var added = $(player).data("added-date");
				if(added === undefined) {
					var added = new Date($(player).data("added"));
					if(!isNaN(added.getTime())) {
						$(player).data("added-date", added);
						added = $(player).data("added-date");
					}
					else
						added = undefined;
				}
				if(added !== undefined) {
					var elapsed = Math.floor(now - added);
					if(elapsed > 0)
						$(player).children(".elapsed").text(timeString(elapsed));
					else
						$(player).children(".elapsed").text("NOW");
				}
			});
		}
		var timeInterval = window.setInterval(updateTimes, 1000 * 10);

		///////////////////
		//    BUTTONS    //
		///////////////////


		window.login = function() {
			var password = $("#password").val();
			$("#password").val("");
			window.api("login", true, {'password':password});
		}
		window.addTable = function() {
			window.api("tables", true);
		};
		window.toggleEdit = function() {
			editMode = !editMode;
			window.refresh();
		};
		window.deleteTable = function(id) {
			window.api("deletetable", true, {'table': id});
		};
		window.startTable = function(table) {
			window.api("starttable", true, {'table': table})
		};
		window.fillTable = function(table) {
			window.api("filltable", true, {'table': table});
		};
		window.notifyTable = function(table) {
			window.api("notifytable", false, {'table': table})
		};
		window.clearTable = function(table) {
			window.api("cleartable", true, {'table': table});
		};
		window.editTable = function(table) {
			if(!editMode)
				return;
			var p = $("#table-" + table);
			var t = p.children("div.topbar");
			var n = t.children("span.name");
			if(n.length === 0) {
				n = t.children("input.newname");
				window.api("edittable", true, {'table':table, 'newname':n.val()});
			}
			else {
				n.replaceWith($("<input id='table-" + table + "' type='text' class='newname' value='" + n.text() + "'></input>"));
				$("#table-" + table).keyup(function(e) {
					if(e.keyCode == 13)
						window.editTable(table);
				});
				$("#table-" + table).focus();
			}
		};
		window.signup = function() {
			var name = $("#name").val();
			var phone = $("#phone").val();
			var numplayers = $("#numplayers").val();
			var type = $("#tabletype").val();
			window.api("queue", true, {'name':name, 'phone':phone, 'numplayers':numplayers, 'type':type});
		};
		window.deletePlayer = function(player) {
			window.api("deleteplayer", true, {'player':player});
		};
		window.editPlayer = function(player) {
			var p = $("#player-" + player);
			var n = p.children("span.name");
			if(n.length === 0) {
				n = p.children("input.newname");
				window.api("editplayer", true, {'player':player, 'newname':n.val()});
			}
			else {
				n.replaceWith($("<input id='player-" + player + "' type='text' class='newname' value='" + n.text() + "'></input>"));
				$("#player-" + player).keyup(function(e) {
					if(e.keyCode == 13)
						window.editPlayer(player);
				}).focus();
			}
		};
		window.notifyPlayer = function(player) {
			window.api("notifyplayer", true, {'player':player});
		};
		window.tableType = function() {
			var data = {'table': $(this).data("table"), 'type': $(this).val()};
			window.api("tabletype", true, data);
		};
		window.tableSchedule = function() {
			var data = {'table': $(this).data("table"), 'time': $(this).val()};
			window.api("tableschedule", true, data);
		};
	});
})(jQuery);
