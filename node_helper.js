var NodeHelper = require("node_helper");
var fs = require("fs");
var lame = require("lame");
var decoder = new lame.Decoder();
var Speaker = require("speaker");
const speaker = new Speaker({
  channels: 2,
  bitDepth: 16,
  sampleRate: 44100
});
var Volume = require("pcm-volume");
var volume = new Volume();
var volumeValue = 1.0;
var stream;
//var audioplay = require("audio-play");
//var audioloader = require("audio-loader");


//var playback;

var current_playlist = [];
var playlists = [];

module.exports = NodeHelper.create({
  start: function() {
    var self=this;
    console.log("Started nodehelper for SMP");
  },

  load_playlist: function(path) {
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
            list.push({title: title, interpret: interpret, duration: duration, path: decodeURI(lines[i].substr(7))});
          }
        }
        self.initiatePlaylist(list,path.substr(path.lastIndexOf("/")+1, path.lastIndexOf(".")-1-path.lastIndexOf("/")));
      });
    }
    
    if(path.endsWith(".m3u")){
      load_m3u_playlist(path);
    }
  },

  initiatePlaylist: function(playlist, name) {
    current_playlist = playlist;
    current_song = 0;
    this.sendSocketNotification("LOADEDPLAYLIST", {playlist: current_playlist, name: "Playlist: " + name});
  },

  socketNotificationReceived: function(notification, payload) {
    var self=this;
    switch(notification){
      case "INITIALIZE":
        fs.readdir("/home/christian/Dokumente/MagicMirror/modules/MMM-SMP-Simple-Music-Player/public/playlists/", (err, files) => {
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
        //this.load_playlist("/home/christian/Dokumente/MagicMirror/modules/MMM-SMP-Simple-Music-Player/public/playlists/saltatio_mortis.m3u");
        this.load_playlist("./modules/MMM-SMP-Simple-Music-Player/public/playlists/"+payload);
        break;
      case "LOADFILE": //payload: number of current song
        /*fs.readFile(current_playlist[payload].path, function(err, data){
          self.sendSocketNotification("PLAYFILE",{path: current_playlist[payload].path,
                                                  title: current_playlist[payload].title,
                                                  interpret: current_playlist[payload].interpret,
                                                  duration: current_playlist[payload].duration,
                                                  data: data});
        });*/
        /*audioloader("/home/christian/Dokumente/MagicMirror/modules/MMM-SMP-Simple-Music-Player/Broken.mp3").then(function(buffer){
          console.log("Audio started.");
          playback = audioplay(buffer, {autoplay: true, rate: 1, detune: 0}, function(){
            console.log("Audio ended.");
          });
        });*/
        stream = fs.createReadStream(current_playlist[payload].path);
        //stream = fs.createReadStream("/home/christian/Dokumente/MagicMirror/modules/MMM-SMP-Simple-Music-Player/Broken.mp3");
        /*stream.pipe(decoder).on('format', function(format) {
          this.pipe(volume);
          volume.pipe(speaker);
        });*/
        stream.pipe(decoder).pipe(volume);
        volume.pipe(speaker);
        break;
      case "PAUSEFILE":
        console.log("SMP - Pause File");
        stream.unpipe();
        stream.pause();
        break;
      case "RESUMEFILE":
        console.log("SMP - Resume File");
        stream.pipe(decoder).pipe(volume);
        //volume.pipe(speaker);
        stream.resume();
        break;
      case "STOPFILE":
        console.log("SMP - Stop File");
        stream.unpipe();
        break;
      case "VOLUMECHANGE":
        volumeValue = payload / 100;
        volume.setVolume(volumeValue);
        break;
    }
  },
});
