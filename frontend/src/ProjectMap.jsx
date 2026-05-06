import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import Map3DViewer from './Map3DViewer';

import { API_BASE as API } from './apiConfig';

const ProjectMap = () => {
  const [waterPoints, setWaterPoints] = useState([]);
  const [reports, setReports] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const fetchData = useCallback(async () => {
    try {
      const [wpRes, rRes, techRes] = await Promise.all([
        axios.get(`${API}/api/waterpoints/`, { headers: authHeader() }),
        axios.get(`${API}/api/reports/`, { headers: authHeader() }),
        axios.get(`${API}/api/technicians/`, { headers: authHeader() }),
      ]);
      setWaterPoints(wpRes.data);
      setReports(rRes.data);
      setTechnicians(techRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ height: 'calc(100vh - 140px)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ height: '100%', width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'center' }}>
        <Map3DViewer
          waterPoints={waterPoints}
          reports={reports}
          technicians={technicians}
          isHero={true}
        />
      </div>
    </div>
  );
};

export default ProjectMap;
