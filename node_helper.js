var NodeHelper = require("node_helper");
var fs = require("fs");
var Path = require('path');
var MusicMetaData = require('musicmetadata');
var Async = require('async');
var http = require('http')

const Telnet = require('telnet-client')

var current_playlist = [];
var playlists = [];
var current_song=0;

module.exports = NodeHelper.create({
  start: function() {
    var self=this;
    self.supported_file_extensions= [ "mp3" ];
    self.supported_playlist_extensions = [ "m3u" ];
    self.folder_structure = [];
    self.server = null;
    self.streamingPort = 0;
    self.config = {};

    // Squeeze variables
    self.squeeze_artists = [];
    self.squeeze_playlists = [];
    self.squeeze_folder_structure = [];
    self.squeeze_initialized = false;
    self.squeeze_polling = false;
    self.squeeze_playerstatus = undefined;
    console.log("Started nodehelper for SMP");
  },

  load_folder: function(name, path, recursive, autoplay){
    var self=this;
    var walk = function(dir, done) {
      var results = [];
      fs.readdir(dir, function(err, list) {
        if (err) return done(err);
        var pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function(file) {
          file = Path.resolve(dir, file);
          fs.stat(file, function(err, stat) {
            if (stat && stat.isDirectory()) {
              if(recursive){
                walk(file, function(err, res) {
                  results = results.concat(res);
                  if (!--pending) done(null, results);
                });
              } else {
                if (!--pending) done(null, results);
              }
            } else {
              if(self.supported_file_extensions.indexOf(file.substring(file.lastIndexOf(".")+1)) != -1){
                results.push({path: file });
              }
              if (!--pending) done(null, results);
            }
          });
        });
      });
    };

    var indexOfPath = function(array, path){
      for(var i=0;i<array.length;i++){
        if(array[i].path == path){
          return i;
        }
      }
      return -1;
    }

    walk(path, function(err, results){
      if(err) throw err;
      Async.each(results,
        function(item, callback){
          var readableStream = fs.createReadStream(item.path);
          var parser = MusicMetaData(readableStream, function(err, metadata) {
            var index = indexOfPath(results, item.path);
            if(index == -1) {console.log("not found "+item.path); callback(); return;}
            if (err) {
              console.log("Could not read metadata for file "+item.path);
              results[ index ].title = item.path.substring(item.path.lastIndexOf("/")+1);
              results[ index ].interpret = "";
            } else {
              results[ index ].title = metadata.title;
              results[ index ].interpret = metadata.artist[0];
            }
            readableStream.close();
            callback();
          });
        },
        function(err){
          if(err) throw err;
          if(results.length == 0){
            self.sendSocketNotification("LOADINGERROR",'');
            return;
          }
          current_playlist = results;
          current_song = 0;
          self.sendSocketNotification("LOADEDPLAYLIST", {playlist: current_playlist, name: "Folder: " + name});
          if(autoplay){
            self.load_file(current_song);
          }
        });
    });
  },

  load_playlist: function(path, autoplay) {
    var self = this;
    
    var indexOfPath = function(array, path){
      for(var i=0;i<array.length;i++){
        if(array[i].path == path){
          return i;
        }
      }
      return -1;
    }

    function load_m3u_playlist(path){
      fs.readFile(path, 'utf8', function(err, data){
        if(err){
          return console.log(err);
        }
        lines = data.split(/\r?\n/);
        var i;
        var list = [];
        for(var i=0;i<lines.length;i++){
          if(lines[i] != "" && lines[i].substr(0,1)!="#"){
            list.push({path: decodeURI(lines[i].substr(lines[i].indexOf("//")+1))});
          }
        }
        Async.each(list,
          function(item, callback){
            var readableStream = fs.createReadStream(item.path);
            var parser = MusicMetaData(readableStream, function(err, metadata) {
              var index = indexOfPath(list, item.path);
              if(index == -1) {console.log("not found "+item.path); callback(); return;}
              if (err) {
                console.log("Could not read metadata for file "+item.path);
                list[ index ].title = item.path.substring(item.path.lastIndexOf("/")+1);
                list[ index ].interpret = "";
              } else {
                list[ index ].title = metadata.title;
                list[ index ].interpret = metadata.artist[0];
              }
              readableStream.close();
              callback();
            });
          },
          function(err){
            if(err) throw err;
            if(list.length == 0){
              self.sendSocketNotification("LOADINGERROR",'');
              return;
            }
            self.initiatePlaylist(list,path.substr(path.lastIndexOf("/")+1, path.lastIndexOf(".")-1-path.lastIndexOf("/")), autoplay);
          });
      });
    }
    
    if(path.endsWith(".m3u")){
      load_m3u_playlist(path);
    }
  },

  initiatePlaylist: function(playlist, name, autoplay) {
    current_playlist = playlist;
    current_song = 0;
    this.sendSocketNotification("LOADEDPLAYLIST", {playlist: current_playlist, name: "Playlist: " + name});
    if(autoplay){
      this.load_file(current_song);
    }
  },

  createMP3Server: function(res){
    const stream = fs.createReadStream(current_playlist[current_song].path);
    stream.pipe(res);
  },

  load_file: function(tracknumber) {
    var self=this;
    if(fs.existsSync(current_playlist[tracknumber].path)){
      if(self.server != null) self.server.close();
      self.server = http.createServer(function (req, res) {
        self.createMP3Server(res);
      });
      self.server.listen(self.streamingPort);
      self.sendSocketNotification("NEWFILE", {tracknumber: tracknumber, title: current_playlist[tracknumber].title, artist: current_playlist[tracknumber].interpret});
    }
  },

  decode_special_char: function(s){
    var scopy = (' '+s).slice(1);
    var sc = [{e:"%20",d:" "},{e:"%3A",d:":"},{e:"%C3",d:""},{e:"%84",d:"Ä"},{e:"%B6",d:"ö"},{e:"%BC", d:"ü"}];
    sc.forEach(function (item,index){
      while(scopy.search(item.e)!=-1){
        scopy = scopy.replace(item.e, item.d);
      }
    });
    return scopy;
  },

  /*
  { [
      {"name": "player_id", "type":"raw"},
      {"type": "fixed", "name": "status"},
      {"type": "fixed", "name": "0"},
      {"type": "fixed"; "name": "9999"},
      {"type": "keys",
        "for_nesting": [
           {"start": "playlist%20index", "type": "keys"}]
      }
    ]
  */
  squeeze_telnetParse: function(data, format){
    var self=this;
    var array = data.split(" ").map(function (val){return val.trim()});
    var result = {};
    var format_element = 0;
    var current_nested;
    var current_nested_index;
    for(var i=0;i<array.length;i++){
        switch(format[format_element].type){
            case "raw":
                result[format[format_element].name] = self.decode_special_char(array[i]);
                format_element++;
                break;
            case "fixed":
                if(array[i] != format[format_element].name){
                    return {error: "fixed \""+format[format_element].name+"\" not found"};
                }
                format_element++;
                break;
            case "keys":
                // is a nested key?
                if(format[format_element].for_nesting){
                    var flag = false;
                    for(var k=0;k<format[format_element].for_nesting.length;k++){
                        if(array[i].startsWith(format[format_element].for_nesting[k].start)){
                            if(!Array.isArray(result[self.decode_special_char(format[format_element].for_nesting[k].start)])){
                                result[self.decode_special_char(format[format_element].for_nesting[k].start)] = [];
                            }
                            var n = {};
                            n[self.decode_special_char(array[i].substr(0,array[i].search("%3A")))] = self.decode_special_char(array[i].substr(array[i].search("%3A")+3))
                            result[self.decode_special_char(format[format_element].for_nesting[k].start)].push(n);
                            current_nested = n;
                            current_nested_index = k;
                            flag = true;
                            break;
                        }
                    }
                    if(!flag){
                        if(current_nested){
                            flag = false;
                            if(Array.isArray(format[format_element].for_nesting[current_nested_index].available_keys) && !format[format_element].for_nesting[current_nested_index].available_keys.includes(array[i].substr(0,array[i].search("%3A")))){
                                current_nested = undefined;
                                current_nested_index = -1;
                                result[self.decode_special_char(array[i].substr(0,array[i].search("%3A")))] = self.decode_special_char(array[i].substr(array[i].search("%3A")+3));
                            } else {
                                current_nested[self.decode_special_char(array[i].substr(0,array[i].search("%3A")))] = self.decode_special_char(array[i].substr(array[i].search("%3A")+3));
                            }
                        } else {
                            result[self.decode_special_char(array[i].substr(0,array[i].search("%3A")))] = self.decode_special_char(array[i].substr(array[i].search("%3A")+3));
                        }
                    }
                } else { // or a simple value
                    result[self.decode_special_char(array[i].substr(0,array[i].search("%3A")))] = self.decode_special_char(array[i].substr(array[i].search("%3A")+3));
                }
                break;
        }
    }
    return result;
  },

  squeeze_telnetConnection: async function(callback){
    var self = this;
    let connection = new Telnet()
   
    // these parameters are just examples and most probably won't work for your use-case.
    let params = {
      host: self.config.squeezeServer,
      port: self.config.squeezePort,
      //shellPrompt: '/ # ', // or negotiationMandatory: false
      negotiationMandatory: false,
      timeout: self.config.squeezeTelnetTimeout,
      sendTimeout: self.config.squeezeTelnetTimeout
    }
   
    try {
      await connection.connect(params)
    } catch(error) {
      // handle the throw (timeout)
      console.error("SMP - Telnet connection error");
      return;
    }
    callback(connection);
  },

  squeeze_pollStatus: function(){
    var self = this;
    if(self.squeeze_polling) return;
    self.squeeze_polling = true;
    self.squeeze_telnetConnection(async function(connection){
      console.log("SMP - Execute cmd: "+self.config.squeezePlayerID+' status 0 9999 ');
      var status_format= [
        {"name": "player_id", "type":"raw"},
        {"type": "fixed", "name": "status"},
        {"type": "fixed", "name": "0"},
        {"type": "fixed", "name": "9999"},
        {"type": "keys",
          "for_nesting": [
             {"start": "playlist%20index", "type": "keys", "available_keys":["id","title"]}]
        }
      ];
      const delay = ms => new Promise(res => setTimeout(res, ms));
      while(self.squeeze_polling){
        var res = await connection.send(self.config.squeezePlayerID+' status 0 9999', {waitfor:"\n"});
        var current_status = self.squeeze_telnetParse(res, status_format);
        if(self.squeeze_playerstatus){
          current_status.current_artist = self.squeeze_playerstatus.current_artist;
        }
        if(!self.squeeze_playerstatus
          || current_status.playlist_cur_index != self.squeeze_playerstatus.playlist_cur_index
          || current_status.playlist_timestamp != self.squeeze_playerstatus.playlist_timestamp){
          var artist_res = await connection.send(self.config.squeezePlayerID+' artist ?', {waitfor:"\n"});
          var artist_format = [
            {"type":"raw", "name":"player_id"},
            {"type":"fixed", "name":"artist"},
            {"type":"raw", "name":"current_artist"}];

          current_status.current_artist = self.squeeze_telnetParse(artist_res, artist_format).current_artist;
        }
        self.squeeze_playerstatus = current_status;
        self.sendSocketNotification("SQUEEZEPLAYERSTATUS",{"status":self.squeeze_playerstatus});
        await delay(50);
      }
    });

  },

  squeeze_loadPlaylist: function(playlist_name, autoplay){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      playlist_name = playlist_name.replace(/\s+/g, "%20");
      console.log("Execute cmd: "+self.config.squeezePlayerID+' playlist play '+playlist_name);
      res = await connection.send(self.config.squeezePlayerID+' playlist play '+playlist_name, {waitfor:"\n"});
    });
  },

  squeeze_loadArtist: function(artist_name, artist_id, autoplay){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      console.log("Execute cmd: "+self.config.squeezePlayerID+' playlistcontrol cmd:load artist_id:'+artist_id);
      res = await connection.send(self.config.squeezePlayerID+' playlistcontrol cmd:load artist_id:'+artist_id, {waitfor:"\n"});
    });
  },

  squeeze_loadFolder: function(folder_id, recursive, autoplay){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      console.log("Execute cmd: "+self.config.squeezePlayerID+' playlistcontrol cmd:load folder_id:'+folder_id);
      res = await connection.send(self.config.squeezePlayerID+' playlistcontrol cmd:load folder_id:'+folder_id, {waitfor:"\n"});
    });
  },

  squeeze_setPlaystate: function(action){
    var self = this;
    self.squeeze_telnetConnection(async function (connection){
      console.log("Execute cmd: "+self.config.squeezePlayerID+' '+action);
      res = await connection.send(self.config.squeezePlayerID+' '+action, {waitfor:"\n"});
    });
  },

  squeeze_NextPrev: function(action){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      var buttoncode = "";
      switch(action){
        case "prev":
          buttoncode = "rew.single";
          break;
        case "next":
          buttoncode = "fwd.single";
          break;
      }

      console.log("Execute cmd: "+self.config.squeezePlayerID+' button '+buttoncode);
      res = await connection.send(self.config.squeezePlayerID+' button '+buttoncode, {waitfor:"\n"});
    });
  },

  squeeze_setLoop: function(value){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      var loopmode = 0;
      switch(value){
        case "loop":
          loopmode=2;
          break;
        case "loop1":
          loopmode=1;
          break;
        case "noloop":
          loopmode=0;
          break;
      }

      console.log("Execute cmd: "+self.config.squeezePlayerID+' playlist repeat '+loopmode);
      res = await connection.send(self.config.squeezePlayerID+' playlist repeat '+loopmode, {waitfor:"\n"});
    });
  },

  squeeze_setShuffle: function(value){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      var shufflemode = 0;
      switch(value){
        case "shuffle":
          shufflemode=1;
          break;
        case "noshuffle":
          shufflemode=0;
          break;
      }

      console.log("Execute cmd: "+self.config.squeezePlayerID+' playlist shuffle '+shufflemode);
      res = await connection.send(self.config.squeezePlayerID+' playlist shuffle '+shufflemode, {waitfor:"\n"});
    });
  },

  squeeze_setVolume: function(percent){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      console.log("Execute cmd: "+self.config.squeezePlayerID+' mixer volume '+percent);
      res = await connection.send(self.config.squeezePlayerID+' mixer volume '+percent, {waitfor:"\n"});
    });
  },

  squeeze_seek: function(time){
    var self = this;
    self.squeeze_telnetConnection(async function(connection){
      console.log("Execute cmd: "+self.config.squeezePlayerID+' time '+time);
      res = await connection.send(self.config.squeezePlayerID+' time '+time, {waitfor:"\n"});
    });
  },

  squeeze_getMusicLibrary: function() {
    var self = this;
    self.squeeze_pollStatus();
    if(self.squeeze_initialized){
      self.sendSocketNotification("INITIALIZE",
        {
          playlists: self.squeeze_playlists.map(function (val) {return val["name"];}),
          folder_structure: self.squeeze_folder_structure,
          artists: self.squeeze_artists
        });
      return;
    }

    console.log("SMP - Squeeze Get Music library from "+self.config.squeezeServer+":"+self.config.squeezePort);
    self.squeeze_telnetConnection(async function(connection){
      var array = []
      let res;

      // Check, if our player is online
      res = await connection.send('players 0 9999', {waitfor:"\n"})
      var player_format = [
        {"type":"fixed", "name":"players"},
        {"type":"fixed", "name":"0"},
        {"type":"fixed", "name":"9999"},
        {"type":"keys",
          "for_nesting":[
            {"start":"playerindex", "type":"keys"}]
        }
      ];
      self.squeeze_players = self.squeeze_telnetParse(res, player_format);
      if(!self.squeeze_players.playerindex) self.squeeze_players.playerindex = [];
      self.squeeze_players = self.squeeze_players.playerindex;
      self.squeeze_players.forEach(function (item,index){item.playerid = self.decode_special_char(item.playerid)});
      //console.log(self.squeeze_players);
      var flag = false;
      for(var i=0;i<self.squeeze_players.length;i++){
        if(self.squeeze_players[i].playerid == self.config.squeezePlayerID){flag = true; break;}
      }
      if(!flag){
        console.error("SMP - ERROR: Configured player is not online!!!");
        self.sendSocketNotification("SHOWERROR",{errormessage:"Configured player is not online!!!"});
      }

      // Load artists
      if(self.config.enableArtistsMenu){
        res = await connection.send('artists 0 9999', {waitfor:"\n"})
        var artist_format =[
					{"type":"fixed", "name":"artists"},
					{"type":"fixed", "name":"0"},
					{"type":"fixed", "name":"9999"},
					{"type":"keys",
							"for_nesting":[
									{"start":"id", "type":"keys", "available_keys":["artist"]}]
					}
				];
        self.squeeze_artists = self.squeeze_telnetParse(res, artist_format).id.map(function (val){ return {name:self.decode_special_char(val.artist), id:val.id}});
        //console.log('async result:', self.squeeze_artists);
      }

      // Load playlists
      res = await connection.send('playlists 0 9999', {waitfor:"\n"});
      var playlist_format = [
        {"type":"fixed", "name":"playlists"},
        {"type":"fixed", "name": "0"},
        {"type":"fixed", "name": "9999"},
        {"type":"keys",
          "for_nesting":[
            {"start":"id", "type":"keys", "available_keys":["playlist"]}]
        }];
      self.squeeze_playlists = self.squeeze_telnetParse(res, playlist_format).id.map(function (val){return {name:self.decode_special_char(val.playlist), id:val.id}});
      //console.log('async result:', self.squeeze_playlists);

      // Load folder structure
      if(self.config.enableFolderMenu){
        var to_walk_folders = [];
        var level = 0;

        res = await connection.send('musicfolder 0 9999', {waitfor:"\n"});
        var folder_format = [
          {"type":"fixed", "name":"musicfolder"},
          {"type":"fixed", "name":"0"},
          {"type":"fixed", "name":"9999"},
          {"type":"keys",
            "for_nesting":[
              {"start":"id", "type":"keys", "available_keys":["filename","type"]}]
          }
        ];
        self.squeeze_folder_structure = self.squeeze_telnetParse(res, folder_format).id.map(function (val){
          content = {
            "id": val.id,
            "path": val.id,
            "name": self.decode_special_char(val.filename),
            "type": val.type,
            "content": [],
            "level": level};
          if(content["type"] == "folder"){
            to_walk_folders.push(content);
          }
          return content;
        });

        while(to_walk_folders.length > 0){
          var current_folder = to_walk_folders.shift();
          res = await connection.send('musicfolder 0 9999 folder_id:'+current_folder["id"], {waitfor:"\n"});
          array = self.squeeze_telnetParse(res, folder_format);
          if(!array.id) array.id = [];
          array = array.id.map(function (val){
            content = {
              "id": val.id,
              "path": val.id,
              "name": self.decode_special_char(val.filename),
              "type": val.type,
              "content": [],
              "level": current_folder["level"]+1};
            if(content["type"] == "folder" && content["level"] < self.config.folderMenuLevelLimit){
              to_walk_folders.push(content);
            }
            return content;
          });
          current_folder["content"] = array.filter(function (val){
              return val["type"] == "folder";
            });
        }
        //console.log(JSON.stringify(self.squeeze_folder_structure, null, 2));
      }

      // Initialize Webclient with collected data
      self.sendSocketNotification("INITIALIZE",
        {
          playlists: self.squeeze_playlists.map(function (val) {return val["name"];}),
          folder_structure: self.squeeze_folder_structure,
          artists: self.squeeze_artists,
          players: self.squeeze_players
        });
      self.squeeze_initialized = true;
    });
  },

  socketNotificationReceived: function(notification, payload) {
    var self=this;
    switch(notification){
      case "INITIALIZE":
        self.config = payload.config;
        console.log("SMP: INITIALIZE");
        // Check, if we want to use LMS/Squeeze
        // if yes, ditch local playback
        if(self.config.useSqueeze){
          self.squeeze_getMusicLibrary();
        } else {
          this.streamingPort = payload.streamingPort;
          var readplaylists = function(done){
            fs.readdir("./modules/MMM-SMP-Simple-Music-Player/public/playlists/", (err, files) => {
              var playlist_list = [];
              files.forEach(file => {
                if(self.supported_playlist_extensions.indexOf(file.substring(file.lastIndexOf(".")+1)) != -1){
                  playlist_list.push(file);
                }
              });
              console.log("Loaded Playlists:");
              playlist_list.forEach(playlist => {
                console.log(playlist);
              });
              done(playlist_list);
            })
          };
          var walk = function(dir, done) {
            var results = [];
            fs.readdir(dir, function(err, list) {
              if (err) return done(err);
              var pending = list.length;
              list.sort();
              if (!pending) return done(null, results);
              list.forEach(function(file) {
                file = Path.resolve(dir, file);
                fs.stat(file, function(err, stat) {
                  if (stat && stat.isDirectory()) {
                    var newentry = {name: file.substring(file.lastIndexOf("/")+1), path: file, content: []};
                    results.push(newentry);
                    walk(file, function(err, res) {
                      newentry.content= res;
                      if (!--pending) done(null, results);
                    });
                  } else {
                    //results.push(file);
                    if (!--pending) done(null, results);
                  }
                });
              });
            });
          };
          var print_folder_structure = function(folder_structure, ebene){
            for(var i=0;i<folder_structure.length;i++){
              console.log("  ".repeat(ebene) + folder_structure[i].name);
              if(folder_structure[i].content.length > 0){
                print_folder_structure(folder_structure[i].content, ebene + 1);
              }
            }
          };
          self.folder_structure = [];
          payload.folders.sort();
          var indexOfPath = function(array, path){
            for(var i=0;i<array.length;i++){
              if(array[i].path == path) return i;
            }
            return -1;
          };
          Async.each(payload.folders,
            function(item, callback){
              if(item.indexOf("/")!=-1){
                self.folder_structure.push({name: item.substring(item.lastIndexOf("/")+1), path: item, content: [] });
              } else {
                self.folder_structure.push({name: item, content: []});
              }
              if(payload.enableFolderMenu){
                walk(item, function(err, results){
                  if(err) {
                    //throw err;
                    console.log("Folder not found");
                    console.log(err);
                    self.sendSocketNotification("LOADINGERROR",'');
                    callback();
                    return;
                  }
                  var index = indexOfPath(self.folder_structure, item);
                  if(index == -1) {console.log("Path not found: "+ item); return;}
                  self.folder_structure[index].content = results;
                  //print_folder_structure(self.folder_structure, 0);
                  callback();
                });
              }else{
                callback();
              }
            },
            function(err){
              readplaylists(function(playlist_list){
                playlists = playlist_list;
                self.sendSocketNotification("INITIALIZE",{playlists: playlists, folder_structure: self.folder_structure});
              });
            });
        }
        break;
      case "LOADPLAYLIST":
        if(self.config.useSqueeze){
          self.squeeze_loadPlaylist(payload.name, payload.autoplay);
        } else {
          this.load_playlist("./modules/MMM-SMP-Simple-Music-Player/public/playlists/"+payload.name, payload.autoplay);
        }
        break;
      case "LOADFOLDER": //payload {name, path, recursive}
        if(self.config.useSqueeze){
          self.squeeze_loadFolder(payload.path, payload.recursive, payload.autoplay); //path is used as ID for squeeze
        } else {
          self.load_folder(payload.name, payload.path, payload.recursive, payload.autoplay);
        }
        break;
      case "LOADARTIST": // payload {name, autoplay}
        if(self.config.useSqueeze){
          self.squeeze_loadArtist(payload.name, payload.id, payload.autoplay);
        }
        break;
      case "LOADFILE": //payload: number of current song
        current_song = payload;
        self.load_file(payload);
        break;
      case "SQUEEZECONTROL": // payload {action}
        switch(payload.action){
          case "play":
          case "pause":
          case "stop":
            self.squeeze_setPlaystate(payload.action);
            break;
          case "next":
          case "prev":
            self.squeeze_NextPrev(payload.action);
            break;
          case "loop":
          case "loop1":
          case "noloop":
            self.squeeze_setLoop(payload.action);
            break;
          case "shuffle":
          case "noshuffle":
            self.squeeze_setShuffle(payload.action);
            break;
          case "volume":
            self.squeeze_setVolume(payload.percent);
            break;
          case "seek":
            self.squeeze_seek(payload.time);
            break;
        }
        break;
    }
  },
});
