var NodeHelper = require("node_helper");
var fs = require("fs");
var groove = require("groove");
var Pend = require('pend');
var Batch = require('batch');
var assert = require('assert');

var volumeValue = 1.0;

var current_playlist = [];
var playlists = [];
var current_song=0;
var stop_flag = false;
var playstatus = "stopped";
var skip_flag = false;

module.exports = NodeHelper.create({
  start: function() {
    var self=this;
    self.loop = "noloop";
    self.shuffle = false;
    console.log("Started nodehelper for SMP");
    self.playlist = groove.createPlaylist();
    self.player = groove.createPlayer();
    self.player.useExactAudioFormat = true;
    self.player.on('devicereopened', function() {
      //console.log("Device re-opened");
    });

    self.player.on('nowplaying', function() {
      if(playstatus == "stopped"){
        console.log("Stop flag triggered");
        return;
      }
      var current = self.player.position();
      if (!current.item) {
        if(current_song == current_playlist.length - 1){
          console.log("End of playlist");
          if(self.shuffle){
            console.log("shuffle is activated");
            self.play_song(Math.floor((Math.random() * current_playlist.length)));
          }
          if(self.loop == "loop"){
            console.log("looping playlist");
            self.play_song(0);
            return;
          }
          self.sendSocketNotification("UPDATE_POSITION", { pos: 0, duration: 0, stop: true, start: false });
          clearInterval(self.pos_update_interval);
          playstatus = "stopped";
          self.player_cleanup(function(){});
          return;
        } else {
          console.log("next track because end of song");
          if(self.loop == "loop1"){
            self.play_song(current_song);
          } else {
            if(self.shuffle){
              console.log("playing shuffle");
              self.play_song(Math.floor((Math.random() * current_playlist.length)));
            }
            else self.play_song(current_song+1);
          }
        }
        return;
      }
      var artist = current.item.file.getMetadata('artist');
      var title = current.item.file.getMetadata('title');
      if(!skip_flag) console.log("Now Playing: " + title + " - " + artist);
      skip_flag = false;
    });
  },

  player_cleanup: function(cb){
    var self=this;
    var batch = new Batch();
    var files = self.playlist.items().map(function(item) { return item.file; });
    self.playlist.clear();
    files.forEach(function(file) {
      batch.push(function(cb) {
        file.close(cb);
      });
    });
    batch.end(function(err) {
      self.player.detach(function(err) {
        if (err) console.error("Fehler: "+err.stack);
        else cb();
      });
    });
  },

  play_song: function(tracknumber){
    var self=this;
    self.player_cleanup(function(){
      current_song = tracknumber;
      self.load_file(current_song);
      playstatus = "playing";
      self.sendSocketNotification("NEWFILE",
          { title: current_playlist[current_song].title,
            interpret: current_playlist[current_song].interpret,
            tracknumber: current_song });
    });
    return;
  },

  load_playlist: function(path, autoplay) {
    var self = this;

    function load_m3u_playlist(path){
      fs.readFile(path, 'utf8', function(err, data){
        if(err){
          return console.log(err);
        }
        lines = data.split(/\r?\n/);
        var i;
        var list = [];
        var title ="";
        var interpret = "";
        var duration = 0;
        for(i=0;i<lines.length;i++){
          if( lines[i].startsWith("#EXTINF") ){
            duration = parseInt(lines[i].substr(8,lines[i].indexOf(",",8)-8));
            interpret = lines[i].substr(lines[i].indexOf(",",8)+1, lines[i].indexOf(" - ")-lines[i].indexOf(",")-1);
            title = lines[i].substr(lines[i].indexOf(" - ")+3);
          } else if(!lines[i].startsWith("#") && lines[i]!== ""){
            list.push({title: title, interpret: interpret, duration: duration, path: decodeURI(lines[i].substr(7)), filehandle: null});
          }
        }
        self.initiatePlaylist(list,path.substr(path.lastIndexOf("/")+1, path.lastIndexOf(".")-1-path.lastIndexOf("/")), autoplay);
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
      current_song = 0;
      playstatus = "playing";
      this.sendSocketNotification("UPDATE_POSITION", { pos: 0, duration: 1, stop: false, start: true});
      this.load_file(current_song);
    }
  },

  load_file: function(tracknumber) {
    var self=this;
    var batch = new Batch();
    batch.push(openMusicFile(current_playlist[tracknumber]));
    batch.end(function(err, files){
      if(files){
        files.forEach(function(file){
          if(file) {
            self.playlist.insert(file);
          }
        });
        self.player.attach(self.playlist, function(err) {
          if(err) console.log(err.stack);
          assert.ifError(err);
        });
        self.pos_update_interval = setInterval(function() {
          var pos = self.player.position();
          var files = self.playlist.items().map(function(item) { return item.file; });
          //console.log("Duration interval: "+pos.pos + " / "+files[0].duration());
          /*if(pos.pos == -1){
          }*/
          if(pos.item){
            self.sendSocketNotification("UPDATE_POSITION", { pos: pos.pos, duration: files[0].duration(), stop: false, start: false});
          }
        }, 1000);
      } else {
        console.log("No files could be loaded:");
        console.log(err.stack);
        self.sendSocketNotification("LOADINGERROR",'');
      }
    });

    function openMusicFile(track) {
      return function(cb) {
        groove.open(track.path, cb);
      };
    }
  },

  socketNotificationReceived: function(notification, payload) {
    var self=this;
    switch(notification){
      case "INITIALIZE":
        fs.readdir("./modules/MMM-SMP-Simple-Music-Player/public/playlists/", (err, files) => {
          playlists = [];
          files.forEach(file => {
            playlists.push(file);
          });
          console.log("Loaded Playlists:");
          playlists.forEach(playlist => {
            console.log(playlist);
          });
          self.sendSocketNotification("INITIALIZE",{playlists: playlists});
        });
        break;
      case "LOADPLAYLIST":
        if(playstatus == "playing"){
          clearInterval(self.pos_update_interval);
          playstatus = "stopped";
          self.player_cleanup(function(){
            self.load_playlist("./modules/MMM-SMP-Simple-Music-Player/public/playlists/"+payload.name, payload.autoplay);
          });
          break;
        }
        this.load_playlist("./modules/MMM-SMP-Simple-Music-Player/public/playlists/"+payload.name, payload.autoplay);
        break;
      case "LOADFILE": //payload: number of current song
        current_song = payload;
        playstatus = "playing";
        self.load_file(payload);
        break;
      case "PAUSEFILE":
        self.playlist.pause();
        break;
      case "RESUMEFILE":
        self.playlist.play();
        break;
      case "STOPFILE":
        if(playstatus == "stopped") break;
        clearInterval(self.pos_update_interval);
        playstatus = "stopped";
        self.player_cleanup(function(){});
        break;
      case "NEXTFILE":
        console.log("nextfile");
        if(self.shuffle) current_song = Math.floor(Math.random()*current_playlist.length);
        else if(current_song >= current_playlist.length - 1){
          if(self.loop == "loop") current_song = 0;
          else                         break;
        } else current_song++;
        if(playstatus != "playing"){
          self.sendSocketNotification("NEWFILE",
            {title: current_playlist[current_song].title,
            interpret: current_playlist[current_song].interpret,
            tracknumber: current_song });
          break;
        }
        clearInterval(self.pos_update_interval);
        playstatus = "stopped";
        self.play_song(current_song);
        break;
      case "PREVIOUSFILE":
        console.log("previous file");
        if(self.shuffle) current_song = Math.floor(Math.random()*current_playlist.length);
        else if(current_song <= 0) {
          if(self.loop == "loop") current_song = current_playlist.length -1;
          else break;
        } else current_song--;
        if(playstatus != "playing"){
          self.sendSocketNotification("NEWFILE",
            {title: current_playlist[current_song].title,
            interpret: current_playlist[current_song].interpret,
            tracknumber: current_song });
          break;
        }
        clearInterval(self.pos_update_interval);
        playstatus = "stopped";
        self.play_song(current_song);
        break;
      case "VOLUMECHANGE":
        volumeValue = payload / 100;
        self.playlist.setGain(volumeValue);
        break;
      case "PLAYERSETTINGS":
        self.loop = payload.loop;
        self.shuffle = payload.shuffle;
        console.log("Setting " + self.loop + " and shuffle " + self.shuffle);
        break;
      case "TIMECHANGE":
        if(skip_flag) break;
        var duration = current_playlist[current_song].duration;
        var pos = self.player.position();
        if(payload.newposition != undefined){
          skip_flag = true;
          self.playlist.seek(pos.item, payload.newposition/100.0*duration);
        } else {
          var newpos = 0;
          switch(payload.direction){
            case "backwards":
              if(pos.pos < duration/20)
                newpos = 0;
              else  newpos = pos.pos - (duration/20);
              break;
            case "forward":
              if(pos.pos + (duration/20) > duration)
                newpos = duration - 1; // -1 for introducing a small buffer, before the next file will be played automatically
              else  newpos = pos.pos + (duration/20);
              break;
          }
          skip_flag = true;
          self.playlist.seek(pos.item, newpos);
        }
        break;
    }
  },
});
