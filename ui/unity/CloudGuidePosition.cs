using UnityEngine;
using System.Runtime.InteropServices;
// Attach this component to the player root (the object that actually moves).
public class CloudGuidePosition : MonoBehaviour {
#if UNITY_WEBGL && !UNITY_EDITOR
 [DllImport("__Internal")] private static extern void CloudGuidePositionReport(float x,float y,float z);
#endif
 void LateUpdate(){
#if UNITY_WEBGL && !UNITY_EDITOR
  var p=transform.position;CloudGuidePositionReport(p.x,p.y,p.z);
#endif
 }
}
