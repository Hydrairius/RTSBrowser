# Skirmish map layout v0

Three **lanes** connect human and AI territories through no man's land. Each player has an **HQ bowl** (open ground for base building) with walls funneling armies into the lanes.

```
        [ Human HQ bowl ]                    [ AI HQ bowl ]
              |                                    |
    North lane o======== neutral ========o North lane
    Mid lane   o======== neutral ========o Mid lane
    South lane o======== neutral ========o South lane
```

| Region | Grid bounds (approx) | Purpose |
|--------|------------------------|---------|
| Human HQ bowl | gx 6–48, gy 50–96 | Spawn + build around HQ (25, 70) |
| AI HQ bowl | gx 118–162, gy 4–50 | Spawn + build around HQ (135, 25) |
| North pass | gy 14–30, gx 78–99 | Fast flank route |
| Mid pass | gy 56–76, gx 78–99 | Central fight |
| South pass | gy 96–116, gx 78–99 | Wide south route |

Barriers implement walls; open cells between them are the navigable paths (A* uses the baked grid).
