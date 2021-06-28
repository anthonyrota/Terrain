use noise::{NoiseFn, Seedable, SuperSimplex};
use rand::{rngs::StdRng, Rng, SeedableRng};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use wasm_bindgen::prelude::*;

struct RGB(u8, u8, u8);

struct ColorRegion {
    max_height: f32,
    color: RGB,
    blend: f32,
}

// const SIZE: u32 = 256;
// const HEIGHT_MAP_ARRAY_LENGTH: usize = 66049;
// const VERTEX_ARRAY_LENGTH: usize = 198147;
// const INDICES_ARRAY_LENGTH: usize = 393216;
// const SIZE: u32 = 512;
// const HEIGHT_MAP_ARRAY_LENGTH: usize = 263169;
// const VERTEX_ARRAY_LENGTH: usize = 789507;
// const INDICES_ARRAY_LENGTH: usize = 1572864;
const SIZE: u32 = 1024;
const HEIGHT_MAP_ARRAY_LENGTH: usize = 1050625;
const VERTEX_ARRAY_LENGTH: usize = 3151875;
const INDICES_ARRAY_LENGTH: usize = 6291456;
type HeightMapArray = [f32; HEIGHT_MAP_ARRAY_LENGTH];
type VertexArray = [f32; VERTEX_ARRAY_LENGTH];
type IndicesArray = [u32; INDICES_ARRAY_LENGTH];
const CHUNK_WIDTH: u32 = SIZE;
const CHUNK_DEPTH: u32 = SIZE;
const MAX_HEIGHT: f32 = 512.0;
const OCTAVES: u32 = 5;
const PERSISTENCE: f32 = 0.25;
const LACUNARITY: f32 = 2.5;
const FINENESS: f32 = 512.0;
const NOISE_SLOPE: f32 = 0.84;
const COLOR_REGIONS_ARRAY_LENGTH: usize = 7;
static COLOR_REGIONS: [ColorRegion; COLOR_REGIONS_ARRAY_LENGTH] = [
    ColorRegion {
        max_height: 0.093,
        color: RGB(201, 178, 99),
        blend: 0.6,
    },
    ColorRegion {
        max_height: 0.164,
        color: RGB(164, 155, 98),
        blend: 0.6,
    },
    ColorRegion {
        max_height: 0.243,
        color: RGB(164, 155, 98),
        blend: 0.6,
    },
    ColorRegion {
        max_height: 0.374,
        color: RGB(120, 127, 160),
        blend: 1.0,
    },
    ColorRegion {
        max_height: 0.571,
        color: RGB(90, 91, 98),
        blend: 1.0,
    },
    ColorRegion {
        max_height: 0.846,
        color: RGB(193, 198, 214),
        blend: 1.0,
    },
    ColorRegion {
        max_height: 1.0,
        color: RGB(235, 236, 240),
        blend: 1.0,
    },
];
const EROSION_DROPS_PER_CELL: f32 = 1.2;
const EROSION_EDGE_DAMP_MIN_DISTANCE: f32 = 2.0;
const EROSION_EDGE_DAMP_MAX_DISTANCE: f32 = 10.0;
const EROSION_EDGE_DAMP_STRENGTH: f32 = 3.0;
const EROSION_INERTIA: f32 = 0.05;
const EROSION_SEDIMENT_CAPACITY_FACTOR: f32 = 1.0;
const EROSION_MIN_SEDIMENT_CAPACITY: f32 = 0.1;
const EROSION_ERODE_SPEED: f32 = 0.3;
const EROSION_DEPOSIT_SPEED: f32 = 0.5;
const EROSION_EVAPORATE_SPEED: f32 = 0.01;
const EROSION_GRAVITY: f32 = 0.2;
const EROSION_MAX_DROPLET_LIFETIME: i32 = 512;
const EROSION_STOP_HEIGHT_START: f32 = 0.37;
const EROSION_STOP_HEIGHT_END: f32 = 0.34;
const EROSION_INITIAL_WATER_VOLUME: f32 = 1.0;
const EROSION_INITIAL_SPEED: f32 = 4.0;
const EROSION_KERNEL_RADIUS: i32 = 2;
const EROSION_KERNEL_ARRAY_SIZE: usize = 25;
type ErosionKernelArray = [f32; EROSION_KERNEL_ARRAY_SIZE];
static EROSION_KERNEL: ErosionKernelArray = [
    0.003765, 0.015019, 0.023792, 0.015019, 0.003765, 0.015019, 0.059912, 0.094907, 0.059912,
    0.015019, 0.023792, 0.094907, 0.150342, 0.094907, 0.023792, 0.015019, 0.059912, 0.094907,
    0.059912, 0.015019, 0.003765, 0.015019, 0.023792, 0.015019, 0.003765,
];
static mut HEIGHT_MAP: HeightMapArray = [0.0; HEIGHT_MAP_ARRAY_LENGTH];
static mut VERTICES: VertexArray = [0.0; VERTEX_ARRAY_LENGTH];
static mut NORMALS: VertexArray = [0.0; VERTEX_ARRAY_LENGTH];
static mut COLORS: VertexArray = [0.0; VERTEX_ARRAY_LENGTH];
static mut INDICES: IndicesArray = [0; INDICES_ARRAY_LENGTH];
static mut SEED: u32 = 0;

#[wasm_bindgen]
pub struct ChunkData {
    pub height_map: u32,
    pub vertices: u32,
    pub normals: u32,
    pub colors: u32,
    pub indices: u32,
}

#[allow(unused_macros)]
macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

#[wasm_bindgen]
pub fn set_seed(new_seed: u32) {
    unsafe {
        SEED = new_seed;
    }
}

fn min<T: PartialOrd>(a: T, b: T) -> T {
    if a < b {
        a
    } else {
        b
    }
}

fn max<T: PartialOrd>(a: T, b: T) -> T {
    if a > b {
        a
    } else {
        b
    }
}

fn calculate_hash<T: Hash>(t: &T) -> u64 {
    let mut s = DefaultHasher::new();
    t.hash(&mut s);
    s.finish()
}

#[derive(Hash)]
struct ChunkSeedHashData {
    g_seed: u32,
    chunk_x: i32,
    chunk_z: i32,
}

#[wasm_bindgen]
pub fn gen_chunk_data(chunk_x: i32, chunk_z: i32) -> ChunkData {
    let seed = unsafe { SEED };
    let height_map = unsafe { &mut HEIGHT_MAP };
    let vertices = unsafe { &mut VERTICES };
    let normals = unsafe { &mut NORMALS };
    let colors = unsafe { &mut COLORS };
    let indices = unsafe { &mut INDICES };

    let simplex = SuperSimplex::new();
    simplex.set_seed(seed);
    let chunk_seed_hash_data = ChunkSeedHashData {
        g_seed: seed,
        chunk_x,
        chunk_z,
    };

    let mut rng = StdRng::seed_from_u64(calculate_hash(&chunk_seed_hash_data));

    let max_possible_noise_value = {
        let mut max: f32 = 0.0;
        let mut amplitude: f32 = 1.0;
        for _ in 0..OCTAVES {
            max += amplitude;
            amplitude *= PERSISTENCE;
        }
        max
    };

    fn calculate_noise_height(
        x: i32,
        z: i32,
        simplex: &SuperSimplex,
        max_possible_noise_value: f32,
    ) -> f32 {
        let noise_x = (x as f32) / FINENESS;
        let noise_z = (z as f32) / FINENESS;
        let mut amplitude: f32 = 1.0;
        let mut frequency: f32 = 1.0;
        let mut accumulated_noise_value: f32 = 0.0;
        for _ in 0..OCTAVES {
            let sample_x = noise_x * frequency;
            let sample_z = noise_z * frequency;
            let noise_value =
                ((1.0 + simplex.get([sample_x as f64, (sample_z as f64)])) / 2.0) as f32;
            accumulated_noise_value += noise_value.powf(NOISE_SLOPE) * amplitude;
            amplitude *= PERSISTENCE;
            frequency *= LACUNARITY;
        }
        return accumulated_noise_value / max_possible_noise_value * MAX_HEIGHT;
    }

    for i in 0..=CHUNK_WIDTH {
        for j in 0..=CHUNK_DEPTH {
            let x = chunk_x * CHUNK_WIDTH as i32 + i as i32;
            let z = chunk_z * CHUNK_DEPTH as i32 + j as i32;
            height_map[(j * (CHUNK_WIDTH + 1) + i) as usize] =
                calculate_noise_height(x as i32, z as i32, &simplex, max_possible_noise_value)
        }
    }

    // Based off https://jobtalle.com/simulating_hydraulic_erosion.html
    // MIT License
    // Copyright (c) 2020 Job Talle
    // Permission is hereby granted, free of charge, to any person obtaining
    // a copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to
    // permit persons to whom the Software is furnished to do so, subject to
    // the following conditions:
    // The above copyright notice and this permission notice shall be
    // included in all copies or substantial portions of the Software.
    fn trace(height_map: &mut HeightMapArray, rng: &mut StdRng) {
        fn get_height_interpolated(x: f32, z: f32, height_map: &HeightMapArray) -> f32 {
            let floor_x = x.floor() as usize;
            let floor_z = z.floor() as usize;

            let grid_offset_x = x - floor_x as f32;
            let grid_offset_z = z - floor_z as f32;

            let height_top_left = height_map[floor_z * (CHUNK_WIDTH as usize + 1) + floor_x];
            let height_top_right = height_map[floor_z * (CHUNK_WIDTH as usize + 1) + (floor_x + 1)];
            let height_bottom_left =
                height_map[(floor_z + 1) * (CHUNK_WIDTH as usize + 1) + floor_x];
            let height_bottom_right =
                height_map[(floor_z + 1) * (CHUNK_WIDTH as usize + 1) + (floor_x + 1)];

            let height_left =
                height_top_left + (height_bottom_left - height_top_left) * grid_offset_z;
            let height_right =
                height_top_right + (height_bottom_right - height_top_right) * grid_offset_z;

            return height_left + (height_right - height_left) * grid_offset_x;
        }

        let mut x = rng.gen_range(0.0, CHUNK_WIDTH as f32);
        let mut z = rng.gen_range(0.0, CHUNK_DEPTH as f32);
        let mut dir_x: f32 = 0.0;
        let mut dir_z: f32 = 0.0;
        let mut speed: f32 = EROSION_INITIAL_SPEED;
        let mut water: f32 = EROSION_INITIAL_WATER_VOLUME;
        let mut sediment: f32 = 0.0;

        for _ in 0..EROSION_MAX_DROPLET_LIFETIME {
            if x < 1.0 || z < 1.0 || x + 1.0 >= CHUNK_WIDTH as f32 || z + 1.0 >= CHUNK_WIDTH as f32
            {
                break;
            }

            let cur_y = get_height_interpolated(x, z, height_map);

            if cur_y / MAX_HEIGHT <= EROSION_STOP_HEIGHT_END {
                break;
            }

            let left = get_height_interpolated(x - 1.0, z, height_map);
            let top = get_height_interpolated(x, z - 1.0, height_map);
            let right = get_height_interpolated(x + 1.0, z, height_map);
            let bottom = get_height_interpolated(x, z + 1.0, height_map);

            let mut norm_x = left - right;
            let mut norm_y: f32 = 2.0;
            let mut norm_z = top - bottom;

            let len2 = norm_x.powi(2) + norm_y.powi(2) + norm_z.powi(2);
            let scale = 1.0 / len2.sqrt();
            norm_x *= scale;
            norm_y *= scale;
            norm_z *= scale;

            if norm_y == 1.0 {
                break;
            }

            let prev_x = x;
            let prev_z = z;
            dir_x = dir_x * EROSION_INERTIA + norm_x * (1.0 - EROSION_INERTIA);
            dir_z = dir_z * EROSION_INERTIA + norm_z * (1.0 - EROSION_INERTIA);
            if dir_x == 0.0 && dir_z == 0.0 {
                break;
            }
            let len = (dir_x * dir_x + dir_z * dir_z).sqrt();
            dir_x /= len;
            dir_z /= len;
            x += dir_x;
            z += dir_z;
            let delta_height = get_height_interpolated(x, z, height_map) - cur_y;

            let dist_to_edge = min(
                prev_x,
                min(
                    prev_z,
                    min(CHUNK_WIDTH as f32 - prev_x, CHUNK_DEPTH as f32 - prev_z),
                ),
            );
            if dist_to_edge <= EROSION_EDGE_DAMP_MIN_DISTANCE {
                break;
            }

            let mut damp_factor = if dist_to_edge <= EROSION_EDGE_DAMP_MAX_DISTANCE {
                ((dist_to_edge - EROSION_EDGE_DAMP_MIN_DISTANCE)
                    / (EROSION_EDGE_DAMP_MAX_DISTANCE - EROSION_EDGE_DAMP_MIN_DISTANCE))
                    .powf(EROSION_EDGE_DAMP_STRENGTH)
            } else {
                1.0
            };

            // Based off https://github.com/SebLague/Hydraulic-Erosion
            // MIT License
            // Copyright (c) 2019 Sebastian Lague
            // Permission is hereby granted, free of charge, to any person obtaining a copy
            // of this software and associated documentation files (the "Software"), to deal
            // in the Software without restriction, including without limitation the rights
            // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
            // copies of the Software, and to permit persons to whom the Software is
            // furnished to do so, subject to the following conditions:
            // The above copyright notice and this permission notice shall be included in all
            // copies or substantial portions of the Software.
            // Calculate the droplet's sediment capacity (higher when moving fast down a slope and contains lots of water)
            let sediment_capacity = max(
                -delta_height * speed * water * EROSION_SEDIMENT_CAPACITY_FACTOR,
                EROSION_MIN_SEDIMENT_CAPACITY,
            );

            damp_factor *= min(
                ((cur_y / MAX_HEIGHT) - EROSION_STOP_HEIGHT_END)
                    / (EROSION_STOP_HEIGHT_START - EROSION_STOP_HEIGHT_END),
                1.0,
            );

            // If carrying more sediment than capacity, or if flowing uphill:
            if sediment > sediment_capacity || delta_height > 0.0 {
                // If moving uphill (deltaHeight > 0) try fill up to the current height, otherwise deposit a fraction of the excess sediment
                let amount_to_deposit = damp_factor
                    * (if delta_height > 0.0 {
                        min(delta_height, sediment)
                    } else {
                        (sediment - sediment_capacity) * EROSION_DEPOSIT_SPEED
                    });

                let floor_x = prev_x.floor() as usize;
                let floor_z = prev_z.floor() as usize;
                let grid_offset_x = prev_x - floor_x as f32;
                let grid_offset_z = prev_z - floor_z as f32;

                height_map[floor_z * (CHUNK_WIDTH as usize + 1) + floor_x] +=
                    amount_to_deposit * (1.0 - grid_offset_x) * (1.0 - grid_offset_z);
                height_map[floor_z * (CHUNK_WIDTH as usize + 1) + (floor_x + 1)] +=
                    amount_to_deposit * grid_offset_x * (1.0 - grid_offset_z);
                height_map[(floor_z + 1) * (CHUNK_WIDTH as usize + 1) + floor_x] +=
                    amount_to_deposit * (1.0 - grid_offset_x) * grid_offset_z;
                height_map[(floor_z + 1) * (CHUNK_WIDTH as usize + 1) + (floor_x + 1)] +=
                    amount_to_deposit * grid_offset_x * grid_offset_z;

                sediment -= amount_to_deposit;
            } else {
                // Erode a fraction of the droplet's current carry capacity.
                // Clamp the erosion to the change in height so that it doesn't dig a hole in the terrain behind the droplet
                let amount_to_erode = damp_factor
                    * min(
                        (sediment_capacity - sediment) * EROSION_ERODE_SPEED,
                        -delta_height,
                    );
                for dz in (-EROSION_KERNEL_RADIUS)..=EROSION_KERNEL_RADIUS {
                    for dx in (-EROSION_KERNEL_RADIUS)..=EROSION_KERNEL_RADIUS {
                        let weight = EROSION_KERNEL[((dz + EROSION_KERNEL_RADIUS)
                            * (EROSION_KERNEL_RADIUS * 2 + 1)
                            + (dx + EROSION_KERNEL_RADIUS))
                            as usize];
                        let idx = (prev_z.floor() as usize + dz as usize) * (SIZE as usize + 1)
                            + (prev_x.floor() as usize + dx as usize);
                        height_map[idx] = max(0.0, height_map[idx] - amount_to_erode * weight);
                    }
                }
                sediment += amount_to_erode;
            }

            speed = max(speed * speed + delta_height * EROSION_GRAVITY, 0.0).sqrt();
            water *= 1.0 - EROSION_EVAPORATE_SPEED;
        }
    }

    let drops_count =
        (EROSION_DROPS_PER_CELL * CHUNK_WIDTH as f32 * CHUNK_DEPTH as f32).floor() as u32;

    for _ in 0..drops_count {
        trace(height_map, &mut rng)
    }

    let chunk_offset_x = chunk_x * CHUNK_WIDTH as i32;
    let chunk_offset_z = chunk_z * CHUNK_DEPTH as i32;

    let mut p = 0;
    let mut p2 = 0;
    for z in 0..=CHUNK_DEPTH {
        for x in 0..=CHUNK_WIDTH {
            let height = height_map[p2];
            let left = if x == 0 {
                calculate_noise_height(
                    (x as i32 + chunk_offset_x) - 1,
                    z as i32 + chunk_offset_z,
                    &simplex,
                    max_possible_noise_value,
                )
            } else {
                height_map[p2 - 1]
            };
            let right = if x == CHUNK_WIDTH {
                calculate_noise_height(
                    (x as i32 + chunk_offset_x) + 1,
                    z as i32 + chunk_offset_z,
                    &simplex,
                    max_possible_noise_value,
                )
            } else {
                height_map[p2 + 1]
            };
            let top = if z == 0 {
                calculate_noise_height(
                    x as i32 + chunk_offset_x,
                    (z as i32 + chunk_offset_z) - 1,
                    &simplex,
                    max_possible_noise_value,
                )
            } else {
                height_map[p2 - (CHUNK_WIDTH + 1) as usize]
            };
            let bottom = if z == CHUNK_DEPTH {
                calculate_noise_height(
                    x as i32 + chunk_offset_x,
                    (z as i32 + chunk_offset_z) + 1,
                    &simplex,
                    max_possible_noise_value,
                )
            } else {
                height_map[p2 + (CHUNK_WIDTH + 1) as usize]
            };
            let top_left = if x == 0 || z == 0 {
                calculate_noise_height(
                    (x as i32 + chunk_offset_x) - 1,
                    (z as i32 + chunk_offset_z) - 1,
                    &simplex,
                    max_possible_noise_value,
                )
            } else {
                height_map[p2 - 1 - (CHUNK_WIDTH + 1) as usize]
            };
            let bottom_right = if x == CHUNK_WIDTH || z == CHUNK_DEPTH {
                calculate_noise_height(
                    (x as i32 + chunk_offset_x) + 1,
                    (z as i32 + chunk_offset_z) + 1,
                    &simplex,
                    max_possible_noise_value,
                )
            } else {
                height_map[p2 + 1 + (CHUNK_WIDTH + 1) as usize]
            };
            p2 += 1;
            let mut norm_x = 2.0 * (left - right) - bottom_right + top_left + bottom - top;
            let mut norm_y: f32 = 6.0;
            let mut norm_z = 2.0 * (top - bottom) + bottom_right + top_left - bottom - left;
            let len2 = norm_x.powi(2) + norm_y.powi(2) + norm_z.powi(2);
            let scale = 1.0 / len2.sqrt();
            norm_x *= scale;
            norm_y *= scale;
            norm_z *= scale;
            normals[p] = norm_x;
            vertices[p] = (x as i32 + chunk_offset_x) as f32;
            p += 1;
            normals[p] = norm_y;
            vertices[p] = height;
            p += 1;
            normals[p] = norm_z;
            vertices[p] = (z as i32 + chunk_offset_z) as f32;
            p += 1;
        }
    }

    p = 0;
    p2 = 0;
    for _ in 0..CHUNK_DEPTH {
        for _ in 0..CHUNK_WIDTH {
            indices[p] = p2 as u32;
            p += 1;
            indices[p] = p2 as u32 + (CHUNK_WIDTH + 1);
            p += 1;
            indices[p] = p2 as u32 + 1;
            p += 1;
            indices[p] = p2 as u32 + (CHUNK_WIDTH + 1);
            p += 1;
            indices[p] = p2 as u32 + 1 + (CHUNK_WIDTH + 1);
            p += 1;
            indices[p] = p2 as u32 + 1;
            p += 1;
            p2 += 1;
        }
        p2 += 1;
    }

    p = 0;
    for j in 0..((CHUNK_WIDTH + 1) * (CHUNK_DEPTH + 1)) {
        let height = height_map[j as usize] / MAX_HEIGHT;
        let mut is_in_region = false;
        for i in 0..COLOR_REGIONS_ARRAY_LENGTH {
            let region = &COLOR_REGIONS[i];
            if height > region.max_height {
                continue;
            }
            is_in_region = true;
            if i > 0 {
                let prev_region = &COLOR_REGIONS[i - 1];
                let blend = min(
                    (height - prev_region.max_height)
                        / ((region.max_height - prev_region.max_height) * region.blend),
                    1.0,
                );
                let r = (prev_region.color.0 as f32 / 255.0)
                    + ((region.color.0 as f32 / 255.0) - (prev_region.color.0 as f32 / 255.0))
                        * blend;
                let g = (prev_region.color.1 as f32 / 255.0)
                    + ((region.color.1 as f32 / 255.0) - (prev_region.color.1 as f32 / 255.0))
                        * blend;
                let b = (prev_region.color.2 as f32 / 255.0)
                    + ((region.color.2 as f32 / 255.0) - (prev_region.color.2 as f32 / 255.0))
                        * blend;
                colors[p] = r;
                p += 1;
                colors[p] = g;
                p += 1;
                colors[p] = b;
                p += 1;
            } else {
                colors[p] = region.color.0 as f32 / 255.0;
                p += 1;
                colors[p] = region.color.1 as f32 / 255.0;
                p += 1;
                colors[p] = region.color.2 as f32 / 255.0;
                p += 1;
            }
            break;
        }
        if !is_in_region {
            colors[p] = 0.0;
            p += 1;
            colors[p] = 0.0;
            p += 1;
            colors[p] = 0.0;
            p += 1;
        }
    }

    return ChunkData {
        height_map: height_map.as_ptr() as u32,
        vertices: vertices.as_ptr() as u32,
        normals: normals.as_ptr() as u32,
        colors: colors.as_ptr() as u32,
        indices: indices.as_ptr() as u32,
    };
}
