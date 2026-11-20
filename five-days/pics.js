/* Pictures for the Five Days page, drawn with the ND Agency Illustration kit (window.NDI).
   Rail pictures: one per band colour, an 80-unit square with a white tile (edge and hard shadow), shown about 36px wide in the rail.
   Waits-on pictures: a 60-unit square with no ground, shown about 22px beside a card's blocker line.
   Waiting on Bryce has no picture on purpose: only the cards he can't move are marked. */
function ndPics(N){
  var C=N.colours;
  function tile(id,title,desc,body){
    N.use('light');
    return N.picture({w:80,h:80,floor:false,id:id,title:title,desc:desc,body:function(){
      return N.box(1.5,1.5,73,73,C.white,{})+body();
    }});
  }
  function bare(id,title,desc,body){
    N.use('light');
    var svg=N.picture({w:60,h:60,floor:false,id:id,title:title,desc:desc,body:body});
    return svg.replace('<rect width="60" height="60" fill="#FFFFFF"/>','');
  }
  /* Rail pictures, one per band colour in the day planner's format, each for its place. */
  var rail={
    'green':function(id){return tile(id,'Home','A kettle on the counter at home.',function(){
      return N.place(13,18,1.4,function(){return N.parts.kettle(0,0)})+N.box(8,62,62,6,C.white,{shadow:false});
    })},
    'green-hatched':function(id){return tile(id,'Garden','A plant in a pot, outside.',function(){
      return N.place(14,4,1.05,function(){return N.parts.plant(18,66)});
    })},
    'yellow':function(id){return tile(id,'Gym','A pair of trainers.',function(){
      return N.place(6,22,1.6,function(){return N.parts.shoe(0,30)+N.parts.shoe(8,16)});
    })},
    'grey-blue':function(id){return tile(id,'Office','The agency\'s own door, standing open, with light coming through.',function(){
      return N.parts.doorway(24,10,30,56)+N.shape([[26,12],[37,16],[37,62],[26,66]],C.white,{shadow:false});
    })},
    'lines-hatched':function(id){return tile(id,'Travel and away','A train, side on.',function(){
      return N.place(4,10,.95,function(){return N.parts.train(0,64)});
    })},
    'orange':function(id){return tile(id,'With friends','Two people standing side by side, seen from behind.',function(){
      return N.place(6,10,.75,function(){return N.person(24,80,{})+N.person(64,80,{})});
    })},
    'navy':function(id){return tile(id,'Home night','A window with a night sky and stars.',function(){
      return N.parts.window(14,10,50,56,{night:true});
    })},
    'ink':function(id){return tile(id,'Not available','A door, shut.',function(){
      return N.parts.doorClosed(23,8,32,60);
    })}
  };
  var who={
    other:function(id){return bare(id,'Waits on someone else','A person seen from behind: someone other than you has the next move.',function(){
      return N.place(0,0,.8,function(){return N.person(37.5,72.5,{})});
    })},
    run:function(id){return bare(id,'Waits on a run or a machine','A laptop, lit: a scheduled run or a machine has the next move.',function(){
      return N.place(6,10,1.6,function(){return N.parts.laptop(0,24,{lit:true})});
    })}
  };
  return {rail:rail,who:who};
}
if(typeof module!=='undefined') module.exports=ndPics;
