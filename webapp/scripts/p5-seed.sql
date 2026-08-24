-- Phase-5 verification seed: a TSX project with Hebrew voice lines + overlays + a music bed.
-- Written to a UTF-8 file so psql reads real Hebrew bytes (not cp1252 -> '?').
INSERT INTO projects (id, user_id, title, template, engine, status, spec_json, duration_sec, width, height, fps, revision)
VALUES (
  'p5demo1', 'j5m1uoyeds2zqp2v2teobp1d', 'Phase5 Demo Short', 'form-card', 'tsx', 'ready',
  jsonb_build_object(
    'id','p5demo1-spec','title','Phase5 Demo Short','template','Short16Formy','engine','tsx',
    'format', jsonb_build_object('width',1080,'height',1920,'fps',30),
    'theme', jsonb_build_object('accent','#6366F1','font','hebrew'),
    'voice', jsonb_build_object(
      'engine','edge','voiceId','he-IL-AvriNeural',
      'lines', jsonb_build_array(
        jsonb_build_object('text','צריך להחתים הרבה לקוחות?','start',0.5,'end',3.23),
        jsonb_build_object('text','טפסים על הנייר. חתימות שצריך לשלוח בדואר.','start',3.3,'end',7.71)
      )
    ),
    'captions', jsonb_build_object('preset','pill','burnIn',true,'style',jsonb_build_object('rtl',true)),
    'scenes', jsonb_build_array(
      jsonb_build_object('id','hook','durationSec',3.3,'overlays', jsonb_build_array(
        jsonb_build_object('id','hook-t','type','text','content','צריך להחתים','x',40,'y',240,'w',1000,'h',100,'start',0,'end',3.3,'animation','rise',
          'style', jsonb_build_object('font','hebrew','size',88,'weight',700,'align','center','color','#ffffff'))
      )),
      jsonb_build_object('id','pain','durationSec',4.5,'overlays', jsonb_build_array(
        jsonb_build_object('id','pain-line','type','text','content','טפסים על נייר','x',40,'y',1250,'w',1000,'h',100,'start',0.2,'end',4.5,'animation','rise',
          'style', jsonb_build_object('font','hebrew','size',70,'weight',700,'align','center','color','#f5d76e'))
      ))
    ),
    'meta', jsonb_build_object('revision',0,'updatedAt','2026-08-22')
  ),
  7.8, 1080, 1920, 30, 0
) ON CONFLICT (id) DO NOTHING;
