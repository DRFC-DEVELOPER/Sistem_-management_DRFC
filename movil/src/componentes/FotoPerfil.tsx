import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { COLOR } from '@/lib/tipos';

// La misma animación que la foto de perfil de la web (web/public/GIF_IA.mp4).
const ANIMACION = require('../../assets/perfil.mp4');
// El video es vertical (480 × 646); el marco usa la misma proporción para que se vea completo, con sus globos de texto.
const PROPORCION = 646 / 480;
// Parte de abajo que se recorta para ocultar la marca de agua del generador.
const RECORTE = 0.08;

/** Foto de perfil animada, en bucle y sin sonido. Si el video no se puede reproducir, muestra las iniciales. */
export function FotoPerfil({ nombre, ancho = 160 }: { nombre: string; ancho?: number }) {
  const [sinVideo, setSinVideo] = useState(false);
  const player = useVideoPlayer(ANIMACION, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => { if (status === 'error') setSinVideo(true); });
    return () => sub.remove();
  }, [player]);

  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <View style={[e.marco, { width: ancho, height: ancho * PROPORCION * (1 - RECORTE), borderRadius: ancho * 0.12 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {sinVideo
        ? <Text style={[e.iniciales, { fontSize: ancho * 0.3 }]}>{iniciales}</Text>
        // textureView para que el video respete las esquinas redondeadas en Android.
        : <VideoView player={player} style={[e.video, { height: ancho * PROPORCION }]} contentFit="cover" nativeControls={false} surfaceType="textureView" />}
    </View>
  );
}

const e = StyleSheet.create({
  marco: { backgroundColor: COLOR.tinta, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 4, borderColor: COLOR.acentoSuave },
  // Pegado arriba y a lo ancho; lo que sobra abajo queda fuera del marco.
  video: { position: 'absolute', top: 0, left: 0, right: 0 },
  iniciales: { color: '#fff', fontWeight: '700' },
});
