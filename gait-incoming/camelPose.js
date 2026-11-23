// Received from Hilal 2026-11-23 (output of another AI model, per the spec
// given to him). Interpolation engine ONLY — the gait itself lives in the
// CAMEL_GAIT.frames data, still to be received. Structure it expects:
// frames[] -> legs{LH,LF,RH,RF:{joints_deg{...}, foot{on_ground,height_m}}},
//             body{...numeric keys}
function camelPose(t) {
  const frames = CAMEL_GAIT.frames;

  const x = Math.max(0, Math.min(1, Number(t) || 0))
            * (frames.length - 1);

  const i = Math.min(
    Math.floor(x),
    frames.length - 2
  );

  const a = x - i;
  const A = frames[i];
  const B = frames[i + 1];

  const mix = (u, v) => u + (v - u) * a;

  const pose = {
    legs: {},
    body: {}
  };

  for (const leg of ["LH", "LF", "RH", "RF"]) {
    const aj = A.legs[leg];
    const bj = B.legs[leg];

    pose.legs[leg] = {
      joints_deg: {},
      foot: {
        on_ground: a < 0.5
          ? aj.foot.on_ground
          : bj.foot.on_ground,
        height_m: mix(
          aj.foot.height_m,
          bj.foot.height_m
        )
      }
    };

    for (const k of Object.keys(aj.joints_deg)) {
      pose.legs[leg].joints_deg[k] =
        mix(aj.joints_deg[k], bj.joints_deg[k]);
    }
  }

  for (const k of Object.keys(A.body)) {
    pose.body[k] = mix(A.body[k], B.body[k]);
  }

  return pose;
}
